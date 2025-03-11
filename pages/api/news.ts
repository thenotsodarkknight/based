import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { NewsTopic, NewsArticle } from "../../types/news";
import { put, head } from "@vercel/blob";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simple keyword-based clustering (can be enhanced with NLP)
function clusterArticlesByTopic(articles: any[]): { [key: string]: any[] } {
    const clusters: { [key: string]: any[] } = {};

    articles.forEach((article) => {
        const titleWords = article.title.toLowerCase().split(/\W+/);
        const keywords = titleWords.filter(
            (word: string) =>
                word.length > 3 &&
                !["the", "and", "for", "with", "from", "this", "that"].includes(word)
        );

        // Use the most prominent keyword as the topic
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
        const { vibe = "" } = req.query;

        // Fetch news from NewsAPI
        const newsResponse = await axios.get("https://newsapi.org/v2/everything", {
            params: {
                apiKey: process.env.NEWSAPI_KEY,
                q: vibe || "news",
                sortBy: "publishedAt,popularity",
                language: "en",
                pageSize: 20,
            },
        });

        const articles = newsResponse.data.articles;

        // Cluster articles by topic
        const clusteredArticles = clusterArticlesByTopic(articles);

        // Process each topic
        const newsTopics: NewsTopic[] = await Promise.all(
            Object.entries(clusteredArticles).map(async ([topic, topicArticles]) => {
                // Collect content for summary
                const combinedContent = topicArticles
                    .map((article: any) => article.content || article.description || article.title)
                    .filter(Boolean)
                    .join("\n");

                // Check Vercel Blob for cached summary
                const cacheKey = `summaries/topic_${encodeURIComponent(topic)}.txt`;
                let summary: string | undefined;
                try {
                    const blobHead = await head(cacheKey, {
                        token: process.env.BLOB_READ_WRITE_TOKEN,
                    });
                    if (blobHead) {
                        const response = await fetch(blobHead.url);
                        summary = await response.text();
                    }
                } catch (error) { }

                // Generate summary if not cached
                if (!summary) {
                    const summaryRes = await openai.chat.completions.create({
                        model: "gpt-4o",
                        messages: [
                            {
                                role: "user",
                                content: `Generate a neutral summary for the following news topic based on these articles: ${combinedContent}`,
                            },
                        ],
                    });
                    summary = summaryRes.choices[0].message.content;

                    // Cache the summary in Vercel Blob
                    await put(cacheKey, summary, {
                        access: "public",
                        token: process.env.BLOB_READ_WRITE_TOKEN,
                        cacheControlMaxAge: 24 * 60 * 60,
                    });
                }

                // Classify bias for each article in the topic
                const articlesWithBias: NewsArticle[] = await Promise.all(
                    topicArticles.map(async (article: any) => {
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
                            title: article.title,
                            url: article.url,
                            content,
                            bias,
                        };
                    })
                );

                // Categorize links based on bias
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

                return {
                    topic: topic.charAt(0).toUpperCase() + topic.slice(1), // Capitalize topic
                    summary,
                    leftLinks,
                    rightLinks,
                    neutralLinks,
                };
            })
        );

        res.status(200).json(newsTopics);
    } catch (error) {
        console.error("Error fetching news:", error);
        res.status(500).json({ error: "Failed to fetch news" });
    }
}