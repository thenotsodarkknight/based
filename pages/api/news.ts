import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import OpenAI from "openai";
import { NewsTopic, BlobMetadata, NewsItem } from "../../types/news";
import { put, list, del } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";

// Initialize AI clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;

let apiCallCount = 0;
const MAX_API_CALLS = 300;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const MAX_TOTAL_TIME_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

// Supported AI models
const AI_MODELS = {
    openai: [
        "gpt-4o",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
        "gpt-4o-mini",
    ],
    anthropic: [
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
    ],
};
const DEFAULT_MODEL = "gpt-4o";

async function safeAICall(
    model: string,
    params: any,
    fallback: () => string,
    timeoutMs: number = 30000 // 30-second timeout per call
): Promise<string> {
    if (apiCallCount >= MAX_API_CALLS) return fallback();
    apiCallCount++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        let response;
        if (model.startsWith("gpt-")) {
            response = await openai.chat.completions.create({
                ...params,
                model,
            }, { signal: controller.signal });
            return response.choices[0].message.content;
        } else if (model.startsWith("claude-")) {
            response = await anthropic.messages.create({
                model,
                max_tokens: 1000,
                messages: params.messages.map((m: any) => ({
                    role: m.role === "user" ? "user" : "assistant",
                    content: m.content,
                })),
            }, { signal: controller.signal });
            return response.content[0].text;
        }
        return fallback();
    } catch (error: any) {
        console.error(`Error with model ${model}:`, error.message);
        return fallback();
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchNewsArticles(query: string, pageSize: number = 5): Promise<any[]> {
    const startTime = Date.now();
    try {
        const response = await axios.get("https://newsapi.org/v2/everything", {
            params: { q: query || "news", sortBy: "popularity", pageSize, apiKey: NEWSAPI_KEY },
            timeout: 10000,
        });
        if (Date.now() - startTime > MAX_TOTAL_TIME_MS) throw new Error("Fetch exceeded 5-minute limit");
        return response.data.articles || [];
    } catch (error: any) {
        console.error("Error fetching articles from NewsAPI:", error.message);
        throw new Error(`NewsAPI error: ${error.message}`);
    }
}

async function processArticles(articles: any[], model: string): Promise<NewsTopic> {
    const startTime = Date.now();
    const results = await Promise.all(
        articles.map(async (article) => {
            const content = article.content || article.description || article.title;

            const heading = await safeAICall(
                model,
                { messages: [{ role: "user", content: `Generate a concise, descriptive heading (5-10 words) for the news event related to this article: ${content}` }] },
                () => article.title || "News Event"
            );

            const summary = await safeAICall(
                model,
                { messages: [{ role: "user", content: `Generate a neutral summary (50-100 words) of the news event behind this article, focusing on an unbiased overview, not the article's content: ${content}` }] },
                () => content.substring(0, 100)
            );

            const biasResult = await safeAICall(
                model,
                { messages: [{ role: "user", content: `Classify the bias with a 1-3 word tag (e.g., neutral, left-leaning). Then, provide a separate, independent explanation (50-100 words) based on language and content, without referencing the tag: ${content}` }] },
                () => "neutral\nThe content appears informative."
            );
            const [bias, ...explanationLines] = biasResult.split("\n");
            const biasExplanation = explanationLines.join("\n").trim();

            const newsItem: NewsItem = {
                heading: heading.trim(),
                summary: summary.trim(),
                source: {
                    url: article.url,
                    name: article.source.name,
                    bias: bias.trim().split(" ")[0], // Ensure 1-3 words, take first
                    biasExplanation,
                },
                lastUpdated: article.publishedAt || new Date().toISOString(),
                modelUsed: model,
            };

            // Global cache with unique key
            const cacheKey = `news/global/${encodeURIComponent(article.url)}-${Date.now()}.json`;
            await put(cacheKey, JSON.stringify(newsItem), {
                access: "public",
                token: process.env.BLOB_READ_WRITE_TOKEN,
                cacheControlMaxAge: CACHE_DURATION / 1000,
            });

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
        const sortedItems = newsItems
            .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
            .slice(0, 5);
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
        let newsItems: NewsTopic;

        if (!vibe) {
            newsItems = await fetchAllCachedNews();
            if (newsItems.length === 0) {
                console.warn("No cached news found, falling back to default query.");
                newsItems = await processArticles(await fetchNewsArticles("news"), model as string);
            }
        } else {
            const query = vibe.toString();
            const articles = await fetchNewsArticles(query);
            if (!articles.length) {
                console.warn("No articles fetched for query:", query);
                return res.status(200).json([]);
            }
            newsItems = await processArticles(articles, model as string);
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