import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import OpenAI from "openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { NewsTopic, BlobMetadata, NewsItem } from "../../types/news";
import { put, list } from "@vercel/blob";
import { z } from "zod";

// Define the output structure type using Zod
const AIOutputSchema = z.object({
    heading: z.string().describe("A descriptive heading for the news event related to the article, no length limit"),
    summary: z.string().describe("A detailed, neutral summary of the news event behind the article. Focus on describing the core event, context, implications, and key facts without summarizing the article’s subjective evaluation."),
    bias: z.string().describe("A single keyword that captures the bias of the article writer. This can be any descriptive term (e.g., neutral, left-leaning, right-leaning, sensationalist, etc.)"),
    biasExplanation: z.string().describe("An explanation of the article writer's perspective or biases, based on tone, word choice, and focus, no length limit"),
});

type AIOutput = z.infer<typeof AIOutputSchema>;

// JSON Schema for OpenAI Structured Outputs
const AIOutputJsonSchema = {
    type: "object",
    properties: {
        heading: { type: "string", description: "A descriptive heading for the news event related to the article, no length limit" },
        summary: { type: "string", description: "A detailed, neutral summary of the news event behind the article. Focus on describing the core event, context, implications, and key facts without summarizing the article’s subjective evaluation." },
        bias: { type: "string", description: "A single keyword that captures the bias of the article writer (e.g., neutral, left-leaning, right-leaning, sensationalist, etc.)" },
        biasExplanation: { type: "string", description: "An explanation of the article writer's perspective or biases, based on tone, word choice, and focus, no length limit" },
    },
    required: ["heading", "summary", "bias", "biasExplanation"],
    additionalProperties: false,
};

const openaiApiKey = process.env.OPENAI_API_KEY;
const newsapiKey = process.env.NEWSAPI_KEY;
const newsdataApiKey = process.env.NEWSDATA_API_KEY; // Add the new API key

let apiCallCount = 0;
const MAX_API_CALLS = 300;
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const MAX_TOTAL_TIME_MS = 5 * 60 * 1000 * 6;

const AI_MODELS = {
    openai: ["o3-mini", "o1-mini", "gpt-4o-mini"],
};
const DEFAULT_MODEL = "o3-mini";

const openai = new OpenAI({ apiKey: openaiApiKey });

// Add a list of domains that OpenAI can't access
const BLOCKED_DOMAINS = [
    "auburnpub.com",
    "news.google.com",
    "news.yahoo.com",
    "ft.com",
    "nytimes.com",
    "wsj.com",
    "bloomberg.com",
    "economist.com",
    "washingtonpost.com",
    "latimes.com",
    "theguardian.com",
    "reuters.com",
    "apnews.com",
    "foreignpolicy.com",
    "theatlantic.com",
    "newyorker.com",
    "forbes.com",
    "cnbc.com",
    "businessinsider.com",
    "nature.com",
    "sciencemag.org",
    "cell.com",
    "pnas.org",
    "thelancet.com",
    "nejm.org",
    "jamanetwork.com",
    "bmj.com",
    "ieeexplore.ieee.org",
    "dl.acm.org",
    "pubs.acs.org",
    "onlinelibrary.wiley.com",
    "journals.sagepub.com",
    "tandfonline.com",
    "link.springer.com",
    "academic.oup.com",
    "sciencedirect.com",
]


async function safeAICall(
    model: string,
    prompt: string,
    article: any,
    timeoutMs: number = 30000
): Promise<AIOutput> {
    while (true) {
        if (apiCallCount >= MAX_API_CALLS) {
            console.warn(`API call limit (${MAX_API_CALLS}) reached, using fallback`);
            const content = article.content || article.description || article.title || "No content available";
            return {
                heading: article.title || "News Event",
                summary: content || "No summary available from the article content.",
                bias: "neutral",
                biasExplanation: `The article titled "${article.title || 'unknown'}" appears neutral due to limited processing.`,
            };
        }
        apiCallCount++;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            if (!AI_MODELS.openai.includes(model)) {
                throw new Error(`Model ${model} not supported. Use one of ${JSON.stringify(AI_MODELS.openai)}`);
            }

            const response = await openai.chat.completions.create({
                model,
                messages: [{ role: "user", content: prompt }],
                max_completion_tokens: 5000,
                reasoning_effort: "medium",
                // Uncomment stream option if supported:
                // stream: true,
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "news_analysis",
                        schema: AIOutputJsonSchema,
                        strict: true,
                    },
                },
            });

            const responseText = response.choices[0]?.message.content;
            if (!responseText) {
                console.error(`No content in response from model ${model}:`, response);
                continue;
            }

            console.log("Raw response from OpenAI:", responseText);
            let parsedResponse: AIOutput;
            try {
                parsedResponse = AIOutputSchema.parse(JSON.parse(responseText));
            } catch (parseError: any) {
                if (parseError.message.includes("Unexpected end of JSON input")) {
                    console.warn("Discarding invalid AI response for article:", article.title);
                    continue;
                }
                throw parseError;
            }
            return parsedResponse;
        } catch (error: any) {
            console.error(`Error with model ${model}:`, error.message);
            continue;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}


async function fetchNewsArticles(query: string, pageSize: number = 3, existingUrls: Set<string>): Promise<any[]> {
    const startTime = Date.now();
    const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago

    // First try NewsAPI
    try {
        const response = await axios.get("https://newsapi.org/v2/everything", {
            params: {
                q: query || "news",
                sortBy: "popularity",
                pageSize,
                from: fromDate,
                apiKey: newsapiKey
            },
            timeout: 10000,
        });
        if (Date.now() - startTime > MAX_TOTAL_TIME_MS) throw new Error("Fetch exceeded 5-minute limit");

        const articles = response.data.articles || [];
        // Filter out articles whose URLs are already stored
        const newArticles = articles.filter(article => !existingUrls.has(article.url));
        console.log(`Fetched ${articles.length} articles from NewsAPI, ${newArticles.length} are new`);
        if (newArticles.length === 0) {
            throw new Error("No new articles fetched from NewsAPI, falling back to Newsdata.io");
        }
        return newArticles;
    } catch (error: any) {
        console.error("Error fetching from NewsAPI:", error.message);

        // Fallback to Newsdata.io
        try {
            console.log("Falling back to Newsdata.io");
            const response = await axios.get("https://newsdata.io/api/1/latest", {
                params: {
                    q: query || "news",
                    language: "en",        // English only
                    country: "us",         // US news only
                    size: pageSize * 2,    // Request more since we'll filter some
                    apikey: newsdataApiKey,
                    excludedomain: BLOCKED_DOMAINS.slice(0, 5).join(','), // API allows max 5 domains
                    removeduplicate: 1,    // Remove duplicate articles
                    prioritydomain: "top", // High-quality sources
                    image: 1               // Only articles with images
                },
                timeout: 10000,
            });

            if (Date.now() - startTime > MAX_TOTAL_TIME_MS) throw new Error("Fetch exceeded 5-minute limit");

            if (!response.data.results || !Array.isArray(response.data.results)) {
                throw new Error("Invalid response from Newsdata.io");
            }

            // Map Newsdata.io format to match NewsAPI format
            const articles = response.data.results
                // Filter out any remaining blocked domains that couldn't fit in the excludedomain parameter
                .filter(item => !BLOCKED_DOMAINS.some(domain => item.link?.includes(domain)))
                .map((item: any) => ({
                    url: item.link,
                    title: item.title,
                    description: item.description,
                    content: item.content || item.description,
                    publishedAt: item.pubDate,
                    source: {
                        name: item.source_id || "Newsdata.io"
                    }
                }));

            // Filter out articles whose URLs are already stored
            const newArticles = articles.filter(article => !existingUrls.has(article.url));
            console.log(`Fetched ${articles.length} articles from Newsdata.io, ${newArticles.length} are new`);
            return newArticles;
        } catch (fallbackError: any) {
            console.error("Error fetching from Newsdata.io:", fallbackError.message);

            // If the original error was a 429, propagate that
            if (error.response && error.response.status === 429) {
                throw new Error("429 Too Many Requests");
            }

            // Otherwise throw a general error
            throw new Error(`News API errors: ${error.message}, Newsdata.io error: ${fallbackError.message}`);
        }
    }
}

async function processArticles(articles: any[], model: string, vibe?: string): Promise<NewsTopic> {
    const startTime = Date.now();

    const prompt = new PromptTemplate({
        template: `
You are an LLM-powered news analysis assistant for "based" that evaluates and categorizes bias in news articles. Given a news article as input, your task is to extract the following details in a JSON object with these keys:

- **heading**: A descriptive headline summarizing the news event related to the article - all named entities should be preserved
- **summary**: A neutral summary of the actual news event covered by the article.
- **bias**: A one-word or hyphenated keyword that categorizes the article’s bias (e.g., neutral, left-leaning, right-leaning, conspiracy-leaning, speculative, racism-leaning, sexism-leaning, etc.). This bias tag should reflect the perspective of the article’s writer rather than the news event.
- **biasExplanation**: A concise explanation of the article writer’s perspective or biases, supported by observations on tone, word choice, and emphasis in the article - with no mention of the article name and force output even if content is small

Guidelines:
- Ensure the heading and summary strictly represent the news event not the article's content or writing style, but all named entities should be preserved.
- The bias tag and explanation should capture how the writer frames the news, including any subtle or overt subjective influences.
- Don't remove any PII data - all named entities should be preserved. DO NOT OMIT ANY SENSITIVE INFORMATION. Keep grotesque information as is, since we are reporting facts, for example, "Luigi Mangione murdered the UnitedHealth CEO"
- Note, according to latest news, Donald Trump is the new President of US, JD Vance is the new Vice President of US.

Examples:
{{"heading": "Tesla Unveils Model Y with Advanced Autopilot Features","summary": "Tesla has officially launched its new Model Y, an electric SUV that features advanced autopilot capabilities, an improved battery range, and enhanced safety systems. The launch event showcased significant updates in production scalability and innovative software enhancements, positioning Tesla to capture a larger share of the competitive electric vehicle market. Industry analysts see this as a pivotal moment in the automotive landscape.","bias": "neutral","biasExplanation": "The article maintains a neutral tone by focusing on factual details of the launch event without inserting subjective commentary"}}
{{"heading": "Government Unveils Progressive Climate Policies","summary": "The government has rolled out an ambitious set of climate policies aimed at boosting renewable energy and promoting social equity. The policy package includes significant investments in green infrastructure and incentives for sustainable practices, signaling a transformative approach to environmental and social reform.","bias": "left-leaning","biasExplanation": "The article adopts a left-leaning perspective by emphasizing the transformative potential of the new policies and their focus on social equity, while downplaying economic concerns"}}
{{"heading": "Controversy Over New Tax Reforms Raises Business Concerns","summary": "The introduction of new tax reforms has sparked widespread debate, with key stakeholders warning of potential negative impacts on economic growth and middle-class stability. The news event centers on concerns regarding increased regulatory burdens and a potential decline in business confidence.","bias": "right-leaning","biasExplanation": "The article exhibits a right-leaning bias by focusing on the potential economic drawbacks and questioning the overall efficacy of the proposed fiscal measures"}}

Get Content from url {url} 
Helper content: {content} but fetch data from url
`,
        inputVariables: ["url", "content"],
    });

    const results = await Promise.all(
        articles.map(async (article) => {
            const url = article.url;
            const content = article.content || article.description || article.title;
            const aiOutput = await safeAICall(model, await prompt.format({ url, content }), article);
            const newsItem: NewsItem = {
                heading: aiOutput.heading.trim(),
                summary: aiOutput.summary.trim(),
                source: {
                    url: article.url,
                    name: article.source.name,
                    bias: aiOutput.bias.trim(),
                    biasExplanation: aiOutput.biasExplanation.trim(),
                },
                lastUpdated: article.publishedAt || new Date().toISOString(),
                modelUsed: model,
            };

            const globalKey = `news/global/${encodeURIComponent(article.url)}.json`;
            await put(globalKey, JSON.stringify(newsItem), {
                access: "public",
                token: process.env.BLOB_READ_WRITE_TOKEN,
                cacheControlMaxAge: CACHE_DURATION / 1000,
            });

            if (vibe && vibe.trim() !== "") {
                const personaKey = `news/personas/${encodeURIComponent(vibe)}/${encodeURIComponent(article.url)}.json`;
                let personaItem: any = null;
                try {
                    const { blobs } = await list({
                        prefix: personaKey,
                        token: process.env.BLOB_READ_WRITE_TOKEN,
                    });
                    if (blobs && blobs.length > 0) {
                        const res = await fetch(blobs[0].url);
                        personaItem = await res.json();
                    }
                } catch (e) {
                    console.error("Error fetching existing persona blob:", e);
                }
                if (personaItem) {
                    if (!personaItem.vibes || !Array.isArray(personaItem.vibes)) {
                        personaItem.vibes = [];
                    }
                    if (!personaItem.vibes.includes(vibe)) {
                        personaItem.vibes.push(vibe);
                    }
                    await put(personaKey, JSON.stringify(personaItem), {
                        access: "public",
                        token: process.env.BLOB_READ_WRITE_TOKEN,
                        cacheControlMaxAge: CACHE_DURATION / 1000,
                    });
                } else {
                    const personaNewsItem = { ...newsItem, vibes: [vibe] };
                    await put(personaKey, JSON.stringify(personaNewsItem), {
                        access: "public",
                        token: process.env.BLOB_READ_WRITE_TOKEN,
                        cacheControlMaxAge: CACHE_DURATION / 1000,
                    });
                }
            }

            if (Date.now() - startTime > MAX_TOTAL_TIME_MS) throw new Error("Processing exceeded 5-minute limit");
            return newsItem;
        })
    );
    return results;
}

async function fetchAllCachedNews(): Promise<NewsTopic> {
    const startTime = Date.now();
    try {
        const { blobs } = await list({
            prefix: "news/global/",
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        const newsItems = await Promise.all(
            blobs.map(async (blob: BlobMetadata) => {
                const response = await fetch(blob.url);
                return (await response.json()) as NewsItem;
            })
        );
        const sortedItems = newsItems.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        if (Date.now() - startTime > MAX_TOTAL_TIME_MS) throw new Error("Cache fetch exceeded 5-minute limit");
        return sortedItems;
    } catch (error: any) {
        console.error("Error fetching cached news:", error);
        return [];
    }
}

// Add this new function to fetch cached news by vibe
async function fetchCachedNewsByVibe(vibe: string): Promise<NewsTopic> {
    const startTime = Date.now();
    try {
        const vibePrefix = `news/personas/${encodeURIComponent(vibe)}/`;
        const { blobs } = await list({
            prefix: vibePrefix,
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        if (!blobs || blobs.length === 0) {
            return [];
        }

        const newsItems = await Promise.all(
            blobs.map(async (blob: BlobMetadata) => {
                const response = await fetch(blob.url);
                return (await response.json()) as NewsItem;
            })
        );

        const sortedItems = newsItems.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

        if (Date.now() - startTime > MAX_TOTAL_TIME_MS) throw new Error("Vibe cache fetch exceeded 5-minute limit");
        return sortedItems;
    } catch (error: any) {
        console.error(`Error fetching cached news for vibe ${vibe}:`, error);
        return [];
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    apiCallCount = 0;
    const startTime = Date.now();
    const MAX_ARTICLES_TO_RETURN = 20; // Maximum number of articles to return

    try {
        const { vibe = "", model = DEFAULT_MODEL, updateAllVibes } = req.query;

        if (updateAllVibes === 'true') {
            // Logic to update news for all vibes
            const vibes = [
                "Tech Enthusiast",
                "Politician",
                "Athlete",
                "Influencer",
                "Actor",
                "Musician",
                "Entrepreneur",
                "Journalist",
                "Academic",
                "Lawyer",
                "Activist",
                "Economist",
                "Cultural Icon",
                "Celebrity",
                "Artist",
            ];

            for (const currentVibe of vibes) {
                // Get existing cached news to determine already stored URLs
                const cachedVibeNews = await fetchCachedNewsByVibe(currentVibe);
                const existingUrls = new Set(cachedVibeNews.map(item => item.source.url));

                // Fetch new articles for the current vibe
                const articles = await fetchNewsArticles(currentVibe, 5, existingUrls);

                if (articles.length) {
                    await processArticles(articles, model as string, currentVibe);
                }
            }

            return res.status(200).json({ message: "News updated for all vibes." });
        }

        if (!AI_MODELS.openai.includes(model as string)) {
            throw new Error(`Unsupported model: ${model}. Use one of ${JSON.stringify(AI_MODELS.openai)}`);
        }

        let newsItems: NewsTopic;

        // Get existing cached news to determine already stored URLs
        const cachedNews = await fetchAllCachedNews();

        // Check if we need to fetch new articles based on the age of the latest article
        const shouldFetchNewArticles = () => {
            if (cachedNews.length === 0) return true;

            // Get the most recent article date
            const latestArticleDate = new Date(cachedNews[0].lastUpdated);
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            // Only fetch if latest article is older than 1 day
            return latestArticleDate < oneDayAgo;
        };

        const existingUrls = new Set(cachedNews.map(item => item.source.url));

        if (!vibe || vibe.toString().trim() === "") {
            // No vibe filter, return all cached news
            newsItems = cachedNews;

            // Only fetch new articles if the latest one is over 1 day old or if we have too few articles
            if ((shouldFetchNewArticles() || newsItems.length < 50) && newsItems.length < 150) {
                console.warn("Fetching new articles - latest news is over a day old or insufficient articles.");
                try {
                    const newArticles = await fetchNewsArticles("news", 3, existingUrls);
                    const newNewsItems = await processArticles(newArticles, model as string);
                    newsItems = [...newNewsItems, ...cachedNews]; // Put new articles first
                }
                catch (error: any) {
                    console.error("Error fetching new articles:", error);
                    // Continue with existing cached news
                }
            }

            // Sort by lastUpdated and limit to MAX_ARTICLES_TO_RETURN
            newsItems = newsItems
                .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
                .slice(0, MAX_ARTICLES_TO_RETURN);
        } else {
            // Vibe filter is provided - first check for cached news with this vibe
            const vibeString = vibe.toString();
            let cachedVibeNews = await fetchCachedNewsByVibe(vibeString);

            if (cachedVibeNews.length > 0) {
                console.log(`Found ${cachedVibeNews.length} cached news items for vibe: ${vibeString}`);
                // Sort by lastUpdated and limit to MAX_ARTICLES_TO_RETURN
                cachedVibeNews = cachedVibeNews
                    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
                    .slice(0, MAX_ARTICLES_TO_RETURN);
                return res.status(200).json(cachedVibeNews);
            }

            // No cached vibe news, fetch new articles
            console.log(`No cached news for vibe: ${vibeString}, fetching new articles`);
            const articles = await fetchNewsArticles(vibeString, 5, existingUrls);

            if (!articles.length) {
                console.warn("No new articles fetched for query:", vibeString);
                // Return all cached news sorted and limited if no new articles
                return res.status(200).json(
                    cachedNews
                        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
                        .slice(0, MAX_ARTICLES_TO_RETURN)
                );
            }

            newsItems = await processArticles(articles, model as string, vibeString);

            // Add some general cached news if we don't have enough vibe-specific articles
            if (newsItems.length < MAX_ARTICLES_TO_RETURN) {
                newsItems = [...newsItems, ...cachedNews];
                newsItems = newsItems
                    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
                    .slice(0, MAX_ARTICLES_TO_RETURN);
            }
        }

        if (Date.now() - startTime > MAX_TOTAL_TIME_MS) {
            throw new Error("Total processing time exceeded 5-minute limit");
        }
        res.status(200).json(newsItems.filter(item => !BLOCKED_DOMAINS.some(domain => item.source.url?.includes(domain))));
    } catch (error: any) {
        console.error("Error processing news:", error);
        if (error.message === "429 Too Many Requests") {
            try {
                const cachedNews = await fetchAllCachedNews();
                if (cachedNews.length > 0) {
                    // Sort and limit to latest 150 articles
                    const sortedCachedNews = cachedNews
                        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
                        .slice(0, MAX_ARTICLES_TO_RETURN);
                    res.status(429).json(sortedCachedNews);
                } else {
                    res.status(429).json({ error: "Too Many Requests" });
                }
            }
            catch (e: any) {
                res.status(500).json({ error: `Failed to fetch news: ${error.message}` });
            }
        } else {
            res.status(500).json({ error: `Failed to fetch news: ${error.message}` });
        }
    }
}