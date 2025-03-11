import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { NewsArticle } from "../../types/news";
import { put, head } from "@vercel/blob";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { vibe = "" } = req.query;

        // Fetch latest and popular news from NewsAPI
        const newsResponse = await axios.get("https://newsapi.org/v2/everything", {
            params: {
                apiKey: process.env.NEWSAPI_KEY,
                q: vibe || "news", // Default to "news" if no vibe
                sortBy: "publishedAt,popularity", // Latest and popular
                language: "en",
                pageSize: 20,
            },
        });

        const articles = newsResponse.data.articles;

        // Process articles for summarization and bias classification
        const processedArticles: NewsArticle[] = await Promise.all(
            articles.map(async (article: any) => {
                const content = article.content || article.description || article.title;
                if (!content) return null;

                // Check Vercel Blob for cached summary
                const cacheKey = `summaries/${encodeURIComponent(article.url)}.txt`;
                let summary: string | undefined;
                try {
                    const blobHead = await head(cacheKey, {
                        token: process.env.BLOB_READ_WRITE_TOKEN,
                    });
                    if (blobHead) {
                        const response = await fetch(blobHead.url);
                        summary = await response.text();
                    }
                } catch (error) {
                    // Blob doesn't exist, proceed to generate
                }

                let bias = "unknown";
                if (!summary) {
                    // Generate summary and bias with OpenAI
                    const [summaryRes, biasRes] = await Promise.all([
                        openai.chat.completions.create({
                            model: "gpt-4o",
                            messages: [
                                {
                                    role: "user",
                                    content: `Generate a neutral summary for this article: ${content}`,
                                },
                            ],
                        }),
                        openai.chat.completions.create({
                            model: "gpt-4o",
                            messages: [
                                {
                                    role: "user",
                                    content: `Classify the political leaning of this article as left-leaning, right-leaning, or neutral: ${content}`,
                                },
                            ],
                        }),
                    ]);

                    summary = summaryRes.choices[0].message.content;
                    bias = biasRes.choices[0].message.content.toLowerCase();

                    // Store summary in Vercel Blob
                    await put(cacheKey, summary, {
                        access: "public",
                        token: process.env.BLOB_READ_WRITE_TOKEN,
                        cacheControlMaxAge: 24 * 60 * 60, // Cache for 24 hours
                    });
                }

                // Categorize links based on LLM bias classification
                const leftLinks = bias.includes("left") ? [article.url] : [];
                const rightLinks = bias.includes("right") ? [article.url] : [];
                const neutralLinks = bias.includes("neutral") ? [article.url] : [];

                return {
                    title: article.title,
                    url: article.url,
                    summary,
                    bias,
                    leftLinks,
                    rightLinks,
                    neutralLinks,
                };
            })
        );

        res.status(200).json(processedArticles.filter(Boolean));
    } catch (error) {
        console.error("Error fetching news:", error);
        res.status(500).json({ error: "Failed to fetch news" });
    }
}