import { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { put, list } from "@vercel/blob";
import { z } from "zod";
import { NewsItem } from "../../../types/news";

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define podcast output schema using Zod
const PodcastOutputSchema = z.object({
    ssml: z.string().describe("The podcast conversation in SSML format with voice markers"),
    title: z.string().describe("A catchy title for the podcast episode"),
    summary: z.string().describe("A brief summary of the podcast content"),
});

type PodcastOutput = z.infer<typeof PodcastOutputSchema>;

// Define JSON schema for OpenAI structured output
const PodcastOutputJsonSchema = {
    type: "object",
    properties: {
        ssml: { type: "string", description: "The podcast conversation in SSML format with appropriate voice markers" },
        title: { type: "string", description: "A catchy title for the podcast episode" },
        summary: { type: "string", description: "A brief summary of the podcast content" },
    },
    required: ["ssml", "title", "summary"],
    additionalProperties: false,
};

// Voice options for the TTS service
const VOICE_OPTIONS = {
    host: "alloy", // Default host voice
    guest: "shimmer", // Default guest voice
};

// Cache duration in seconds (24 hours)
const CACHE_DURATION = 24 * 60 * 60;

/**
 * Generates a podcast conversation in SSML format based on a news item
 */
async function generatePodcastSSML(newsItem: NewsItem): Promise<PodcastOutput> {
    const prompt = new PromptTemplate({
        template: `
You are creating a podcast script for a two-person conversation about a news item. 
Create an engaging, informative podcast episode that discusses the following news:

HEADLINE: {heading}
SUMMARY: {summary}
SOURCE BIAS: {bias} - {biasExplanation}

Create a conversation between a host and a guest expert who discuss this news item:
1. The host should introduce the news, ask insightful questions, and guide the conversation
2. The guest should provide expert analysis, additional context, and balanced perspective

Format your response as proper SSML (Speech Synthesis Markup Language) with these requirements:
- Use <speak> as the root element
- Mark speaker changes with <mark name="speaker:host"/> for host and <mark name="speaker:guest"/> for guest
- Add appropriate <break> tags between turns and for emphasis
- Use <prosody> tags to adjust rate, pitch, and volume for emphasis where appropriate
- Use <emphasis> tags to highlight important points

The conversation should be 2-3 minutes long when spoken, balanced between speakers, and should cover:
- The key facts of the news item
- Why this matters in a broader context
- Different perspectives on the topic
- Potential implications or consequences

Keep the tone conversational, engaging, and accessible to a general audience.
`,
        inputVariables: ["heading", "summary", "bias", "biasExplanation"],
    });

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "user",
                content: await prompt.format({
                    heading: newsItem.heading,
                    summary: newsItem.summary,
                    bias: newsItem.source.bias,
                    biasExplanation: newsItem.source.biasExplanation,
                }),
            },
        ],
        max_completion_tokens: 4000,
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "news_analysis",
                schema: PodcastOutputJsonSchema,
                strict: true,
            },
        },
    });

    const responseText = response.choices[0]?.message.content;
    if (!responseText) {
        throw new Error("No content in AI response");
    }

    try {
        return PodcastOutputSchema.parse(JSON.parse(responseText));
    } catch (error) {
        console.error("Failed to parse AI response:", error);
        throw new Error("Invalid AI response format");
    }
}

/**
 * Converts SSML to audio using OpenAI's text-to-speech API
 */
async function convertSSMLToAudio(ssml: string): Promise<Buffer> {
    const response = await openai.audio.speech.create({
        model: "tts-1",
        input: ssml,
        voice: VOICE_OPTIONS.host as "alloy" | "shimmer" | "ash" | "coral" | "echo" | "fable" | "onyx" | "nova" | "sage",
        response_format: "mp3",
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
}

/**
 * Check if a podcast for this news item already exists in cache
 */
async function checkCachedPodcast(newsUrl: string): Promise<{ exists: boolean, url?: string, title?: string, summary?: string }> {
    try {
        const podcastKey = `podcasts/${encodeURIComponent(newsUrl)}`;
        const { blobs } = await list({
            prefix: podcastKey,
            token: process.env.BLOB_READ_WRITE_TOKEN as string,
        });

        if (blobs && blobs.length > 0) {
            // Find the metadata blob
            const metadataBlob = blobs.find(blob => blob.pathname.endsWith('metadata.json'));
            if (metadataBlob) {
                const res = await fetch(metadataBlob.url);
                const metadata = await res.json();
                return {
                    exists: true,
                    url: metadata.audioUrl,
                    title: metadata.title,
                    summary: metadata.summary
                };
            }
        }
        return { exists: false };
    } catch (error) {
        console.error("Error checking cached podcast:", error);
        return { exists: false };
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { newsItem } = req.body;

        if (!newsItem || !newsItem.heading || !newsItem.summary) {
            return res.status(400).json({ error: "Missing or invalid news item" });
        }

        // Check if podcast already exists in cache
        const cachedPodcast = await checkCachedPodcast(newsItem.source.url);
        if (cachedPodcast.exists) {
            console.log("Using cached podcast for:", newsItem.heading);
            return res.status(200).json({
                title: cachedPodcast.title,
                summary: cachedPodcast.summary,
                audioUrl: cachedPodcast.url,
                cached: true
            });
        }

        // Generate podcast SSML
        const podcastOutput = await generatePodcastSSML(newsItem);

        // Convert SSML to audio
        const audioBuffer = await convertSSMLToAudio(podcastOutput.ssml);

        // Create unique identifiers for storage
        const newsUrlHash = encodeURIComponent(newsItem.source.url);
        const timestamp = Date.now();

        // Store audio in Vercel Blob storage
        const audioFileName = `podcasts/${newsUrlHash}/audio-${timestamp}.mp3`;
        const audioBlob = await put(audioFileName, audioBuffer, {
            access: "public",
            token: process.env.BLOB_READ_WRITE_TOKEN as string,
            contentType: "audio/mpeg",
            cacheControlMaxAge: CACHE_DURATION,
        });

        // Store metadata for future retrieval
        const metadata = {
            title: podcastOutput.title,
            summary: podcastOutput.summary,
            audioUrl: audioBlob.url,
            newsUrl: newsItem.source.url,
            newsHeading: newsItem.heading,
            generatedAt: new Date().toISOString()
        };

        const metadataFileName = `podcasts/${newsUrlHash}/metadata.json`;
        await put(metadataFileName, JSON.stringify(metadata), {
            access: "public",
            token: process.env.BLOB_READ_WRITE_TOKEN as string,
            contentType: "application/json",
            cacheControlMaxAge: CACHE_DURATION,
        });

        // Return podcast metadata and audio URL
        res.status(200).json({
            title: podcastOutput.title,
            summary: podcastOutput.summary,
            ssml: podcastOutput.ssml,
            audioUrl: audioBlob.url,
        });
    } catch (error: any) {
        console.error("Error generating podcast:", error);
        res.status(500).json({ error: `Failed to generate podcast: ${error.message}` });
    }
}
