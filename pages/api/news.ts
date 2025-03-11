import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { NewsTopic } from "../../types/news";
import { put, head, del } from "@vercel/blob";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Global counter for OpenAI API calls for this request
let apiCallCount = 0;
const MAX_API_CALLS = 300;

/**
 * A helper that wraps an OpenAI call.
 * If the maximum API call limit has been reached, it returns a fallback value.
 */
async function safeOpenAICall(
    params: { model: string; messages: any[] },
    fallback: () => string
): Promise<string> {
    if (apiCallCount >= MAX_API_CALLS) {
        return fallback();
    }
    apiCallCount++;
    const response = await openai.chat.completions.create(params);
    return response.choices[0].message.content;
}

// Fetch articles using GDELT Document API.
async function fetchArticles(query: string, pageSize: number = 20): Promise<any[]> {
    try {
        const response = await axios.get("https://api.gdeltproject.org/api/v2/doc/doc", {
            params: {
                query: query,
                mode: "ArtList",
                maxrecords: pageSize,
                sort: "DateDesc",
                format: "json",
            },
            timeout: 10000,
        });
        // Assume articles are returned in "articles"
        return response.data.articles || [];
    } catch (error: any) {
        console.error("Error fetching articles from GDELT:", error.message);
        throw new Error(`GDELT API error: ${error.message}`);
    }
}

// Cluster articles by taking the first non-trivial keyword from the title.
function clusterArticlesByTopic(articles: any[]): { [key: string]: any[] } {
    const clusters: { [key: string]: any[] } = {};
    articles.forEach((article) => {
        if (!article.title) return;
        const titleWords = article.title.toLowerCase().split(/\W+/);
        const keywords = titleWords.filter(
            (word: string) =>
                word.length > 3 &&
                !["the", "and", "for", "with", "from", "this", "that"].includes(word)
        );
        const topicKey = keywords[0] || "general";
        if (!clusters[topicKey]) {
            clusters[topicKey] = [];
        }
        clusters[topicKey].push(article);
    });
    return clusters;
}

// Helper to classify articles in batches with a concurrency limit.
async function classifyArticles(articles: any[], concurrency: number = 10): Promise<{ url: string; bias: string }[]> {
    const results: { url: string; bias: string }[] = [];
    for (let i = 0; i < articles.length; i += concurrency) {
        const batch = articles.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(async (article) => {
                const content = article.content || article.description || article.title;
                const bias = await safeOpenAICall(
                    {
                        model: "gpt-4o",
                        messages: [
                            {
                                role: "user",
                                content: `Classify the political leaning of this article as left-leaning, right-leaning, or neutral: ${content}`,
                            },
                        ],
                    },
                    () => "neutral" // fallback: assume neutral if limit reached
                );
                return {
                    // For GDELT, we assume the article URL is in the "url" field.
                    url: article.url,
                    bias: bias.toLowerCase(),
                };
            })
        );
        results.push(...batchResults);
    }
    return results;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Reset the global API call counter at the start of each request
    apiCallCount = 0;

    try {
        const { vibe = "", refresh = "false" } = req.query;
        const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

        // Fetch a small set of initial articles to keep processing fast.
        const initialArticles = await fetchArticles(vibe ? vibe.toString() : "news", 3);
        console.log("Fetched articles count:", initialArticles.length);
        if (!initialArticles || initialArticles.length === 0) {
            console.error("No articles fetched. Check your query.");
            return res.status(200).json([]);
        }

        const clusteredArticles = clusterArticlesByTopic(initialArticles);
        console.log("Clusters generated:", Object.keys(clusteredArticles));
        if (Object.keys(clusteredArticles).length === 0) {
            console.warn("No clusters found, returning empty topics array.");
            return res.status(200).json([]);
        }

        const newsTopics: NewsTopic[] = await Promise.all(
            Object.entries(clusteredArticles).map(async ([tempTopic, topicArticles]) => {
                const combinedContent = topicArticles
                    .map((article: any) => article.content || article.description || article.title)
                    .filter(Boolean)
                    .join("\n");

                // Generate a concise topic name using OpenAI.
                const topic = (await safeOpenAICall(
                    {
                        model: "gpt-4o",
                        messages: [
                            {
                                role: "user",
                                content: `Generate a concise and descriptive topic name (5-10 words) for the following group of news articles: ${combinedContent}`,
                            },
                        ],
                    },
                    () => tempTopic // fallback: use default cluster name if limit reached
                )).trim();
                console.log("Generated topic:", topic);

                const cacheKey = `topics/${encodeURIComponent(topic)}.json`;
                let cachedData: NewsTopic | null = null;
                try {
                    const blobHead = await head(cacheKey, { token: process.env.BLOB_READ_WRITE_TOKEN });
                    if (blobHead) {
                        const response = await fetch(blobHead.url);
                        const data = await response.json();
                        const lastUpdated = new Date(data.lastUpdated).getTime();
                        if (Date.now() - lastUpdated < cacheDuration && refresh !== "true") {
                            console.log("Using cached data for topic:", topic);
                            return data as NewsTopic;
                        }
                        cachedData = data as NewsTopic;
                        await del(cacheKey, { token: process.env.BLOB_READ_WRITE_TOKEN });
                    }
                } catch (error) {
                    console.log(`Cache check error for ${topic}:`, error);
                }

                // Fetch a few additional articles to broaden the sample.
                const additionalArticles = await fetchArticles(topic, 5);
                const allArticles = [...topicArticles, ...additionalArticles];
                const allContent = allArticles
                    .map((article: any) => article.content || article.description || article.title)
                    .filter(Boolean)
                    .join("\n");

                // Generate a neutral summary using OpenAI.
                const summary = (await safeOpenAICall(
                    {
                        model: "gpt-4o",
                        messages: [
                            {
                                role: "user",
                                content: `Generate a neutral summary (50-100 words) of the news topic based on the following combined content from multiple sources: ${allContent}. Focus on providing an unbiased overview without favoring any perspective.`,
                            },
                        ],
                    },
                    () => allContent.substring(0, 200) // fallback: use truncated content
                )).trim();

                // Classify articles' bias using our helper.
                const articlesWithBias = await classifyArticles(allArticles, 10);

                const leftLinks: string[] = [];
                const rightLinks: string[] = [];
                const neutralLinks: string[] = [];
                articlesWithBias.forEach((article) => {
                    if (article.bias.includes("left")) {
                        leftLinks.push(article.url);
                    } else if (article.bias.includes("right")) {
                        rightLinks.push(article.url);
                    } else {
                        neutralLinks.push(article.url);
                    }
                });

                const newTopic: NewsTopic = {
                    topic,
                    summary,
                    leftLinks,
                    rightLinks,
                    neutralLinks,
                    lastUpdated: new Date().toISOString(),
                };

                // Cache the new topic data.
                await put(cacheKey, JSON.stringify(newTopic), {
                    access: "public",
                    token: process.env.BLOB_READ_WRITE_TOKEN,
                    cacheControlMaxAge: cacheDuration / 1000,
                });

                return newTopic;
            })
        );

        res.status(200).json(newsTopics);
    } catch (error: any) {
        console.error("Error fetching news:", error);
        res.status(500).json({ error: `Failed to fetch news: ${error.message}` });
    }
}
