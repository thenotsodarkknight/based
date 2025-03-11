import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import OpenAI from "openai";
import { NewsTopic } from "../../types/news";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const NEWSAPI_KEY = process.env.NEWSAPI_KEY; // Add this to your .env file

// Global counter for OpenAI API calls
let apiCallCount = 0;
const MAX_API_CALLS = 300;

/**
 * Wraps OpenAI calls with a fallback if the API limit is reached.
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

// Fetch news articles from NewsAPI
async function fetchNewsArticles(query: string, pageSize: number = 5): Promise<any[]> {
    try {
        const response = await axios.get("https://newsapi.org/v2/everything", {
            params: {
                q: query || "news", // Default to "news" if no query
                sortBy: "popularity", // Fetch popular articles
                pageSize: pageSize,
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

// Process articles into NewsItems
async function processArticles(articles: any[]): Promise<NewsTopic> {
    return Promise.all(
        articles.map(async (article) => {
            const content = article.content || article.description || article.title;

            // Generate a heading for the news
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
                () => article.title || "News Event" // Fallback to article title
            );

            // Generate a neutral summary for the news
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
                () => content.substring(0, 100) // Fallback to truncated content
            );

            // Classify the political leaning of the article
            const biasResult = await safeOpenAICall(
                {
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: `Classify the political leaning of this article as left-leaning, right-leaning, or neutral, and provide a brief explanation: ${content}`,
                        },
                    ],
                },
                () => "neutral\nNo analysis available due to API limit." // Fallback
            );
            const [bias, ...explanation] = biasResult.split("\n");
            const biasExplanation = explanation.join("\n").trim();

            return {
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
        })
    );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    apiCallCount = 0; // Reset counter per request

    try {
        const { vibe = "" } = req.query;
        const query = vibe ? vibe.toString() : "news";

        // Fetch 5 latest/popular articles based on the persona filter
        const articles = await fetchNewsArticles(query, 5);
        if (!articles.length) {
            console.warn("No articles fetched for query:", query);
            return res.status(200).json([]);
        }

        // Process articles into NewsItems
        const newsItems: NewsTopic = await processArticles(articles);

        res.status(200).json(newsItems);
    } catch (error: any) {
        console.error("Error processing news:", error);
        res.status(500).json({ error: `Failed to fetch news: ${error.message}` });
    }
}