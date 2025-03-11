import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { NewsTopic } from "../../types/news";
import { put, head, del } from "@vercel/blob";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Updated to use NewsDataHub API
async function fetchArticles(query: string, pageSize: number = 20): Promise<any[]> {
    const response = await axios.get("https://newsdatahub.io/api/1/news", {
        params: {
            apikey: process.env.NEWSDATAHUB_API_KEY, // Set this in your Vercel env vars
            q: query,
            language: "en",
            page_size: pageSize,  // Adjust page_size as needed
        },
    });
    // NewsDataHub returns articles in the "results" field
    return response.data.results;
}

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { vibe = "", refresh = "false" } = req.query;
        const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

        // Fetch initial articles from NewsDataHub (pageSize set to 10)
        const initialArticles = await fetchArticles(vibe ? vibe.toString() : "news", 10);
        console.log("Fetched articles count:", initialArticles.length);

        if (!initialArticles || initialArticles.length === 0) {
            console.error("No articles fetched. Check your NEWSDATAHUB_API_KEY or query.");
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

                // Generate a concise topic name using OpenAI (using gpt-4o)
                const topicRes = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: `Generate a concise and descriptive topic name (5-10 words) for the following group of news articles: ${combinedContent}`,
                        },
                    ],
                });
                const topic = topicRes.choices[0].message.content.trim() || tempTopic;
                console.log("Generated topic:", topic);

                // Build a cache key for this topic
                const cacheKey = `topics/${encodeURIComponent(topic)}.json`;
                let cachedData: NewsTopic | null = null;

                // Check if cached data exists and is recent
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

                // Fetch additional articles using the generated topic as query (pageSize set to 50)
                const additionalArticles = await fetchArticles(topic, 50);
                const allArticles = [...topicArticles, ...additionalArticles];
                const allContent = allArticles
                    .map((article: any) => article.content || article.description || article.title)
                    .filter(Boolean)
                    .join("\n");

                // Generate a neutral summary using OpenAI (using gpt-4o)
                const summaryRes = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: `Generate a neutral summary (50-100 words) of the news topic based on the following combined content from multiple sources: ${allContent}. Focus on providing an unbiased overview without favoring any perspective.`,
                        },
                    ],
                });
                const summary = summaryRes.choices[0].message.content.trim();

                // Classify bias for each article using OpenAI (using gpt-4o)
                const articlesWithBias = await Promise.all(
                    allArticles.map(async (article: any) => {
                        const content = article.content || article.description || article.title;
                        const biasRes = await openai.chat.completions.create({
                            model: "gpt-4o",
                            messages: [
                                {
                                    role: "user",
                                    content: `Classify the political leaning of this article as left-leaning, right-leaning, or neutral: ${content}`,
                                },
                            ],
                        });
                        const bias = biasRes.choices[0].message.content.toLowerCase();
                        return {
                            url: article.link,  // Note: NewsDataHub uses "link" for article URL
                            bias,
                        };
                    })
                );

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

                // Cache the new topic data
                await put(cacheKey, JSON.stringify(newTopic), {
                    access: "public",
                    token: process.env.BLOB_READ_WRITE_TOKEN,
                    cacheControlMaxAge: cacheDuration / 1000,
                });

                return newTopic;
            })
        );

        res.status(200).json(newsTopics);
    } catch (error) {
        console.error("Error fetching news:", error);
        res.status(500).json({ error: `Failed to fetch news: ${error}` });
    }
}
