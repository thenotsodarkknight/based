import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import OpenAI from "openai";
import { NewsTopic, BlobMetadata, NewsItem } from "../../types/news";
import { put, list } from "@vercel/blob";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;

let apiCallCount = 0;
const MAX_API_CALLS = 300;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

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

async function fetchNewsArticles(query: string, pageSize: number = 5): Promise<any[]> {
    try {
        const response = await axios.get("https://newsapi.org/v2/everything", {
            params: {
                q: query || "news",
                sortBy: "popularity",
                pageSize,
                apiKey: NEWSAPI_KEY,
            },
            timeout: 10000,
        });
        return response.data.articles || [];
    } catch (error: any) {
        console.error("Error fetching articles from NewsAPI:", error.message);
        throw new Error(`NewsAPI error: ${error.message}`);
    }
}

async function processArticles(articles: any[]): Promise<NewsTopic> {
    return Promise.all(
        articles.map(async (article) => {
            const content = article.content || article.description || article.title;

            const heading = await safeOpenAICall(
                {
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: `Generate a concise, descriptive heading (5-10 words) for this news article: ${content}`,
                        },
                    ],
                },
                () => article.title || "News Event"
            );

            const summary = await safeOpenAICall(
                {
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: `Generate a neutral summary (50-100 words) for this news article, focusing on an unbiased overview: ${content}`,
                        },
                    ],
                },
                () => content.substring(0, 100)
            );

            const biasResult = await safeOpenAICall(
                {
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: `Classify the political or editorial bias of this article (e.g., left-leaning, right-leaning, neutral, sensationalist, etc.) and provide a brief explanation: ${content}`,
                        },
                    ],
                },
                () => "neutral\nNo analysis available due to API limit."
            );
            const [bias, ...explanation] = biasResult.split("\n");
            const biasExplanation = explanation.join("\n").trim();

            const newsItem: NewsItem = {
                heading: heading.trim(),
                summary: summary.trim(),
                source: {
                    url: article.url,
                    name: article.source.name,
                    bias: bias.trim().toLowerCase(),
                    biasExplanation,
                },
                lastUpdated: article.publishedAt || new Date().toISOString(),
            };

            const cacheKey = `news/${encodeURIComponent(article.url)}.json`;
            await put(cacheKey, JSON.stringify(newsItem), {
                access: "public",
                token: process.env.BLOB_READ_WRITE_TOKEN,
                cacheControlMaxAge: CACHE_DURATION / 1000,
            });

            return newsItem;
        })
    );
}

async function fetchAllCachedNews(): Promise<NewsTopic> {
    try {
        const { blobs } = await list({
            prefix: "news/",
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        const newsItems = await Promise.all(
            blobs.map(async (blob: BlobMetadata) => {
                const response = await fetch(blob.url);
                return (await response.json()) as NewsItem;
            })
        );
        return newsItems
            .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
            .slice(0, 5);
    } catch (error: any) {
        console.error("Error fetching cached news:", error);
        return [];
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    apiCallCount = 0;

    try {
        const { vibe = "" } = req.query;
        let newsItems: NewsTopic;

        if (!vibe) {
            newsItems = await fetchAllCachedNews();
            if (newsItems.length === 0) {
                console.warn("No cached news found, falling back to default query.");
                newsItems = await processArticles(await fetchNewsArticles("news"));
            }
        } else {
            const query = vibe.toString();
            const articles = await fetchNewsArticles(query);
            if (!articles.length) {
                console.warn("No articles fetched for query:", query);
                return res.status(200).json([]);
            }
            newsItems = await processArticles(articles);
        }

        res.status(200).json(newsItems);
    } catch (error: any) {
        console.error("Error processing news:", error);
        res.status(500).json({ error: `Failed to fetch news: ${error.message}` });
    }
}