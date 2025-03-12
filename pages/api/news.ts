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

let apiCallCount = 0;
const MAX_API_CALLS = 300;
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const MAX_TOTAL_TIME_MS = 5 * 60 * 1000 * 2;

const AI_MODELS = {
    openai: ["o3-mini", "o1-mini", "gpt-4o-mini"],
};
const DEFAULT_MODEL = "o3-mini";

const openai = new OpenAI({ apiKey: openaiApiKey });

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
                max_completion_tokens: 500,
                reasoning_effort: "low",
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
    try {
        const response = await axios.get("https://newsapi.org/v2/everything", {
            params: { q: query || "news", sortBy: "popularity", pageSize, apiKey: newsapiKey },
            timeout: 10000,
        });
        if (Date.now() - startTime > MAX_TOTAL_TIME_MS) throw new Error("Fetch exceeded 5-minute limit");

        const articles = response.data.articles || [];
        return articles;
    } catch (error: any) {
        console.error("Error fetching articles from NewsAPI:", error.message);
        throw new Error(`NewsAPI error: ${error.message}`);
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
- Don't remove any PII data - all named entities should be preserved

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    apiCallCount = 0;
    const startTime = Date.now();

    try {
        const { vibe = "", model = DEFAULT_MODEL } = req.query;
        if (!AI_MODELS.openai.includes(model as string)) {
            throw new Error(`Unsupported model: ${model}. Use one of ${JSON.stringify(AI_MODELS.openai)}`);
        }

        let newsItems: NewsTopic;
        // Get existing cached news to determine already stored URLs
        const cachedNews = await fetchAllCachedNews();
        const existingUrls = new Set(cachedNews.map(item => item.source.url));

        if (!vibe || vibe.toString().trim() === "") {
            newsItems = cachedNews;
            if (newsItems.length === 0 || newsItems.length < 9) { // Adjust threshold as needed
                console.warn("Insufficient cached news, fetching new articles.");
                const newArticles = await fetchNewsArticles("news", 3, existingUrls);
                newsItems = await processArticles(newArticles, model as string);
                newsItems = [...cachedNews, ...newsItems]; // Combine with existing if desired
            }
        } else {
            const query = vibe.toString();
            const articles = await fetchNewsArticles(query, 2, existingUrls);
            if (!articles.length) {
                console.warn("No new articles fetched for query:", query);
                return res.status(200).json(cachedNews); // Return cached if no new articles
            }
            newsItems = await processArticles(articles, model as string, vibe as string);
        }

        if (Date.now() - startTime > MAX_TOTAL_TIME_MS) {
            throw new Error("Total processing time exceeded 5-minute limit");
        }
        res.status(200).json(newsItems);
    } catch (error: any) {
        console.error("Error processing news:", error);
        res.status(500).json({ error: `Failed to fetch news: ${error.message}` });
    }
}