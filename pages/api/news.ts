import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { NewsTopic } from "../../types/news";
import { put, head } from "@vercel/blob";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
        const { vibe = "" } = req.query;

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

        const clusteredArticles = clusterArticlesByTopic(articles);

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

                // Generate a neutral summary based on all links' content
                if (!summary) {
                    const summaryRes = await openai.chat.completions.create({
                        model: "gpt-4o",
                        messages: [
                            {
                                role: "user",
                                content: `Generate a neutral summary (50-100 words) of the news topic based on the following combined content from multiple sources: ${combinedContent}. Focus on providing an unbiased overview of the topic without favoring any perspective.`,
                            },
                        ],
                    });
                    summary = summaryRes.choices[0].message.content;

                    await put(cacheKey, summary, {
                        access: "public",
                        token: process.env.BLOB_READ_WRITE_TOKEN,
                        cacheControlMaxAge: 24 * 60 * 60,
                    });
                }

                // Classify bias for each article and categorize links
                const articlesWithBias = await Promise.all(
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

                return {
                    topic,
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