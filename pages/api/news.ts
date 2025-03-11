import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { NewsTopic } from "../../types/news";
import { put, head, del } from "@vercel/blob";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function fetchArticles(query: string, pageSize: number = 20): Promise<any[]> {
    const response = await axios.get("https://newsapi.org/v2/everything", {
        params: {
            apiKey: process.env.NEWSAPI_KEY,
            q: query,
            sortBy: "publishedAt,popularity",
            language: "en",
            pageSize,
        },
    });
    return response.data.articles;
}

function clusterArticlesByTopic(articles: any[]): { [key: string]: any[] } {
    const clusters: { [key: string]: any[] } = {};

    articles.forEach((article) => {
        const titleWords = article.title.toLowerCase().split(/\W+/);
        const keywords = titleWords.filter(
            (word: string) =>
                word.length > 3 &&
                !["the", "and", "for", "with", "from", "this", "that"].includes(word)
        );

        const topic = keywords[0] || "general";
        if (!clusters[topic]) {
            clusters[topic] = [];
        }
        clusters[topic].push(article);
    });

    return clusters;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { vibe = "", refresh = "false" } = req.query;
        const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        // Initial fetch to get some articles for topic generation
        const query = Array.isArray(vibe) ? vibe[0] : vibe;
        const initialArticles = await fetchArticles(query || "news", 10);
        const clusteredArticles = clusterArticlesByTopic(initialArticles);

        const newsTopics: NewsTopic[] = await Promise.all(
            Object.entries(clusteredArticles).map(async ([tempTopic, topicArticles]) => {
                const combinedContent = topicArticles
                    .map((article: any) => article.content || article.description || article.title)
                    .filter(Boolean)
                    .join("\n");

                // Generate a descriptive topic name using AI
                const topicRes = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: `Generate a concise and descriptive topic name (5-10 words) for the following group of news articles: ${combinedContent}`,
                        },
                    ],
                });
                const topic = topicRes.choices[0].message.content || tempTopic;

                // Cache key for this topic
                const cacheKey = `topics/${encodeURIComponent(topic)}.json`;
                let cachedData: NewsTopic | null = null;

                // Check if cached data exists and is recent
                try {
                    const blobHead = await head(cacheKey, {
                        token: process.env.BLOB_READ_WRITE_TOKEN,
                    });
                    if (blobHead) {
                        const response = await fetch(blobHead.url);
                        const data = await response.json();
                        const lastUpdated = new Date(data.lastUpdated).getTime();
                        if (Date.now() - lastUpdated < cacheDuration && refresh !== "true") {
                            return data as NewsTopic;
                        }
                        cachedData = data as NewsTopic;
                        await del(cacheKey, { token: process.env.BLOB_READ_WRITE_TOKEN }); // Delete old cache
                    }
                } catch (error) {
                    console.log(`No valid cache for ${topic} or error:`, error);
                }

                // Fetch more articles using the AI-generated topic name
                const additionalArticles = await fetchArticles(topic, 50);
                const allArticles = [...topicArticles, ...additionalArticles];

                const allContent = allArticles
                    .map((article: any) => article.content || article.description || article.title)
                    .filter(Boolean)
                    .join("\n");

                // Generate a neutral summary based on all articles
                const summaryRes = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: `Generate a neutral summary (50-100 words) of the news topic based on the following combined content from multiple sources: ${allContent}. Focus on providing an unbiased overview of the topic without favoring any perspective.`,
                        },
                    ],
                });
                const summary = summaryRes.choices[0].message.content;

                // Classify bias for each article and categorize links
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
                            url: article.url,
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

        res.status(200).json(newsTopics); // Fixed typo: newTopics -> newsTopics
    } catch (error) {
        console.error("Error fetching news:", error);
        res.status(500).json({ error: "Failed to fetch news" });
    }
}