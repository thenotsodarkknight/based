import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { OpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { StructuredOutputParser } from "langchain/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { NewsTopic, BlobMetadata, NewsItem } from "../../types/news";
import { put, list } from "@vercel/blob";
import { z } from "zod";

// Define the output structure type using Zod
const AIOutputSchema = z.object({
    heading: z.string().min(5).max(10).describe("A concise, descriptive heading (5-10 words) for the news event related to the article"),
    summary: z.string().min(50).max(100).describe("A neutral summary (50-100 words) of the news event behind the article, without introductory text"),
    bias: z.string().min(1).max(3).describe("A strict 1-3 word bias tag (e.g., neutral, left-leaning, sensationalist)"),
    biasExplanation: z.string().min(50).max(100).describe("A separate, independent explanation (50-100 word) of the bias based on language and content"),
});

type AIOutput = z.infer<typeof AIOutputSchema>;

const openaiApiKey = process.env.OPENAI_API_KEY;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const newsapiKey = process.env.NEWSAPI_KEY;

let apiCallCount = 0;
const MAX_API_CALLS = 300;
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const MAX_TOTAL_TIME_MS = 5 * 60 * 1000;

const AI_MODELS = {
    openai: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-4o-mini"],
    anthropic: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
};
const DEFAULT_MODEL = "gpt-4o-mini";

// Initialize LLMs
const openai = new OpenAI({ apiKey: openaiApiKey, temperature: 0.7 });
const anthropic = new ChatAnthropic({ apiKey: anthropicApiKey, temperature: 0.7 });

async function safeAICall(
    model: string,
    prompt: string,
    parser: StructuredOutputParser<typeof AIOutputSchema>,
    fallback: () => AIOutput,
    timeoutMs: number = 30000
): Promise<AIOutput> {
    if (apiCallCount >= MAX_API_CALLS) return fallback();
    apiCallCount++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        let llm = model.startsWith("gpt-") ? openai : anthropic;
        const fullPrompt = parser.getFormatInstructions() + "\n\n" + prompt;
        const response = await llm.invoke(fullPrompt, { signal: controller.signal });

        // Handle different response structures (OpenAI vs. Anthropic)
        let responseText: string;
        if (typeof response === 'string') {
            responseText = response;
        } else if (Array.isArray(response.content)) {
            // Anthropic response: content is an array of MessageContentComplex
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

        const parsedResponse = await parser.parse(responseText);
        return parsedResponse;
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
    const parser = StructuredOutputParser.fromZodSchema(AIOutputSchema);

    const prompt = new PromptTemplate({
        template: `Based on the following content, provide the requested outputs. Content: {content}`,
        inputVariables: ["content"],
        outputParser: parser,
    });

    const results = await Promise.all(
        articles.map(async (article) => {
            const content = article.content || article.description || article.title;

            const { heading, summary, bias, biasExplanation } = await safeAICall(
                model,
                await prompt.format({ content }), // Removed unnecessary await
                parser,
                () => ({ heading: article.title || "News Event", summary: content.substring(0, 100), bias: "neutral", biasExplanation: "No analysis available." })
            );

            const newsItem: NewsItem = {
                heading: heading.trim(),
                summary: summary.trim(),
                source: {
                    url: article.url,
                    name: article.source.name,
                    bias: bias.trim().split(" ")[0], // Ensure 1-3 words, take first
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