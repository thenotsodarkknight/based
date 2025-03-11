import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { OpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { PromptTemplate } from "@langchain/core/prompts";
import { NewsTopic, BlobMetadata, NewsItem } from "../../types/news";
import { put, list } from "@vercel/blob";
import { z } from "zod";

// Define the output structure type using Zod
const AIOutputSchema = z.object({
    heading: z.string().describe("A descriptive heading for the news event related to the article, no length limit"),
    summary: z.string().describe("A neutral summary of the news event behind the article, as detailed as desired, no length limit"),
    bias: z.string().describe("A single keyword bias tag (e.g., neutral, left-leaning, sensationalist)"),
    biasExplanation: z.string().describe("An explanation of the article writer's perspective or biases, based on tone, word choice, and focus, no length limit"),
});

// Use Zod inference for AIOutput type
type AIOutput = z.infer<typeof AIOutputSchema>;

const openaiApiKey = process.env.OPENAI_API_KEY;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const newsapiKey = process.env.NEWSAPI_KEY;

let apiCallCount = 0;
const MAX_API_CALLS = 300;
const MAX_RETRIES = 2; // Retries for LLM failures
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const MAX_TOTAL_TIME_MS = 5 * 60 * 1000;

const AI_MODELS = {
    openai: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-4o-mini"],
    anthropic: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
};
const DEFAULT_MODEL = "gpt-4o-mini";

// Initialize LLMs with higher max_tokens
const openai = new OpenAI({ apiKey: openaiApiKey, temperature: 0.5, maxTokens: 600 }); // Lower temperature, higher tokens
const anthropic = new ChatAnthropic({ apiKey: anthropicApiKey, temperature: 0.5, maxTokens: 600 });

async function safeAICall(
    model: string,
    prompt: string,
    article: any,
    timeoutMs: number = 30000,
    retryCount: number = 0
): Promise<AIOutput> {
    if (apiCallCount >= MAX_API_CALLS) {
        console.warn(`API call limit (${MAX_API_CALLS}) reached, using fallback`);
        const content = article.content || article.description || article.title || "No content available";
        return {
            heading: article.title || "News Event",
            summary: content || "No summary available from the article content.",
            bias: "neutral",
            biasExplanation: `The article titled "${article.title || 'unknown'}" appears neutral due to limited processing. The content, starting with "${content.slice(0, 20)}...", focuses on factual reporting without evident editorial slant. The writer avoids strong opinions, aiming to inform rather than persuade. This objective stance is inferred from the available text, constrained by the lack of LLM processing, resulting in a default neutral assessment based on the content's tone and focus.`
        };
    }
    apiCallCount++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        let llm = model.startsWith("gpt-") ? openai : anthropic;
        const response = await llm.invoke(prompt, { signal: controller.signal });

        // Handle different response structures (OpenAI vs. Anthropic)
        let responseText: string;
        if (typeof response === 'string') {
            responseText = response;
        } else if (Array.isArray(response.content)) {
            const firstContent = response.content[0];
            if (firstContent && 'type' in firstContent && firstContent.type === 'text') {
                responseText = firstContent.text || '';
            } else {
                responseText = '';
            }
        } else if (typeof response.content === 'string') {
            responseText = response.content;
        } else {
            responseText = '';
        }

        if (!responseText) {
            console.error(`No valid response text from model ${model}, using fallback`);
            const content = article.content || article.description || article.title || "No content available";
            return {
                heading: article.title || "News Event",
                summary: content || "No summary available from the article content.",
                bias: "neutral",
                biasExplanation: `The article titled "${article.title || 'unknown'}" appears neutral due to limited processing. The content, starting with "${content.slice(0, 20)}...", focuses on factual reporting without evident editorial slant. The writer avoids strong opinions, aiming to inform rather than persuade. This objective stance is inferred from the available text, constrained by the lack of LLM processing, resulting in a default neutral assessment based on the content's tone and focus.`
            };
        }

        // Manually parse with Zod
        const parsedResponse = AIOutputSchema.parse(JSON.parse(responseText));
        return parsedResponse;
    } catch (error: any) {
        console.error(`Error with model ${model}:`, error.message);

        // Implement retry logic
        if (retryCount < MAX_RETRIES) {
            console.log(`Retrying (${retryCount + 1}/${MAX_RETRIES}) with refined prompt...`);
            const refinedPrompt = `${prompt}\n\nPrevious attempt failed with error: ${error.message}. Ensure the output strictly adheres to the schema: heading (no length limit), summary (no length limit), bias (single keyword), biasExplanation (no length limit).`;
            return safeAICall(model, refinedPrompt, article, timeoutMs, retryCount + 1);
        }

        // Fallback using real article data
        const content = article.content || article.description || article.title || "No content available";
        return {
            heading: article.title || "News Event",
            summary: content || "No summary available from the article content.",
            bias: "neutral",
            biasExplanation: `The article titled "${article.title || 'unknown'}" appears neutral due to limited processing. The content, starting with "${content.slice(0, 20)}...", focuses on factual reporting without evident editorial slant. The writer avoids strong opinions, aiming to inform rather than persuade. This objective stance is inferred from the available text, constrained by the lack of LLM processing, resulting in a default neutral assessment based on the content's tone and focus.`
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchNewsArticles(query: string, pageSize: number = 5): Promise<any[]> {
    const startTime = Date.now();
    try {
        const response = await axios.get("https://newsapi.org/v2/everything", {
            params: { q: query || "news", sortBy: "popularity", pageSize, apiKey: newsapiKey },
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

    const prompt = new PromptTemplate({
        template: `
            Based on the following content, provide the requested outputs in JSON format. Use the example below as a guide to meet format requirements. There are no length limits for heading, summary, or biasExplanation, but bias must be a single keyword.

            - heading: A descriptive heading for the news event related to the article, no length limit.
            - summary: A neutral summary of the news event behind the article, as detailed as desired, no length limit.
            - bias: A single keyword bias tag (e.g., neutral, left-leaning, sensationalist).
            - biasExplanation: An explanation of the article writer's perspective or biases, based on tone, word choice, and focus, no length limit.

            Example (for content: "New Tesla Model Y launched with advanced autopilot"):
            {
                "heading": "Tesla Unveils Model Y with Advanced Autopilot Features",
                "summary": "Tesla has launched the Model Y, an electric SUV equipped with advanced autopilot technology that enhances safety and navigation. The vehicle boasts an improved battery range and a sleek, modern design, appealing to eco-conscious drivers. The launch event emphasized production scalability and introduced new software updates, with industry analysts highlighting its strong market potential. Reception has been largely positive, though some discussions focus on its pricing competitiveness compared to other electric vehicles, as Tesla seeks to solidify its dominance in the EV sector.",
                "bias": "neutral",
                "biasExplanation": "The writer maintains a neutral perspective throughout the article, focusing on factual details about the Model Y's features, market reception, and Tesla's goals. The tone is informative and balanced, presenting both the vehicle's strengths, such as advanced technology, and potential challenges, like pricing debates, without favoring one side. The language avoids emotional or sensational phrasing, aiming to educate readers about the launch and its implications in the electric vehicle industry with an objective approach."
            }

            Content: {content}

            Output format:
            {
                "heading": "...",
                "summary": "...",
                "bias": "...",
                "biasExplanation": "..."
            }
        `,
        inputVariables: ["content"],
    });

    const results = await Promise.all(
        articles.map(async (article) => {
            const content = article.content || article.description || article.title;

            const { heading, summary, bias, biasExplanation } = await safeAICall(
                model,
                await prompt.format({ content }),
                article
            );

            const newsItem: NewsItem = {
                heading: heading.trim(),
                summary: summary.trim(),
                source: {
                    url: article.url,
                    name: article.source.name,
                    bias: bias.trim(), // Ensure single keyword
                    biasExplanation: biasExplanation.trim(),
                },
                lastUpdated: article.publishedAt || new Date().toISOString(),
                modelUsed: model,
            };

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
        if (!AI_MODELS.openai.concat(AI_MODELS.anthropic).includes(model as string)) {
            throw new Error(`Unsupported model: ${model}. Use one of ${JSON.stringify(AI_MODELS)}`);
        }

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