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
 * Generates a podcast conversation in SSML format based on multiple news items
 */
async function generatePodcastSSML(newsItems: NewsItem[]): Promise<PodcastOutput> {
    // Create a stringified version of the news items for the prompt
    const newsItemsText = newsItems.map((item, index) => `
NEWS ITEM ${index + 1}:
HEADLINE: ${item.heading}
SUMMARY: ${item.summary}
SOURCE BIAS: ${item.source.bias} - ${item.source.biasExplanation}
`).join('\n');

    const prompt = new PromptTemplate({
        template: `
You are creating a podcast script for a two-person conversation about current news topics.
Create an engaging, informative podcast episode that discusses the following news items:

${newsItemsText}

Create a conversation between a host and a guest expert who discuss these news items:
1. The host should introduce each topic, ask insightful questions, and guide the conversation
2. The guest should provide expert analysis, additional context, and balanced perspective
3. The host should smoothly transition between different news topics
4. Cover all news items, but spend more time on the most significant or interesting ones

Format your response as proper SSML (Speech Synthesis Markup Language) with these requirements:
- Use <speak> as the root element
- Mark speaker changes with <mark name="speaker:host"/> for host and <mark name="speaker:guest"/> for guest
- Add appropriate <break> tags between turns and for emphasis
- Use <prosody> tags to adjust rate, pitch, and volume for emphasis where appropriate
- Use <emphasis> tags to highlight important points

The conversation should be 3-5 minutes long when spoken, balanced between speakers, and should cover:
- The key facts of each news item
- Why these stories matter in a broader context
- Different perspectives on the topics
- Potential implications or consequences

Keep the tone conversational, engaging, and accessible to a general audience.
`,
        inputVariables: [],
    });

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "user",
                content: await prompt.format({}),
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
 * Create a unique hash for a set of news items
 */
function createNewsItemsHash(newsItems: NewsItem[]): string {
    // Create a simple hash based on URLs and timestamps
    const urls = newsItems.map(item => item.source.url).sort().join('|');
    const timestamp = new Date().toISOString().split('T')[0]; // Use date only for daily caching
    return encodeURIComponent(`${timestamp}_${urls.substring(0, 100)}`);
}

/**
 * Check if a podcast for this collection of news items already exists in cache
 */
async function checkCachedPodcast(newsItemsHash: string): Promise<{ exists: boolean, url?: string, title?: string, summary?: string }> {
    try {
        const podcastKey = `podcasts/multi/${newsItemsHash}`;
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
        const { newsItems } = req.body;

        if (!newsItems || !Array.isArray(newsItems) || newsItems.length === 0) {
            return res.status(400).json({ error: "Missing or invalid news items" });
        }

        // Create a unique hash for this collection of news items
        const newsItemsHash = createNewsItemsHash(newsItems);

        // Check if podcast already exists in cache
        const cachedPodcast = await checkCachedPodcast(newsItemsHash);
        if (cachedPodcast.exists) {
            console.log("Using cached multi-topic podcast");
            return res.status(200).json({
                title: cachedPodcast.title,
                summary: cachedPodcast.summary,
                audioUrl: cachedPodcast.url,
                cached: true
            });
        }

        // Generate podcast SSML
        const podcastOutput = await generatePodcastSSML(newsItems);

        // Convert SSML to audio
        const audioBuffer = await convertSSMLToAudio(podcastOutput.ssml);

        // Create unique identifiers for storage
        const timestamp = Date.now();

        // Store audio in Vercel Blob storage
        const audioFileName = `podcasts/multi/${newsItemsHash}/audio-${timestamp}.mp3`;
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
            newsItemsCount: newsItems.length,
            newsHeadings: newsItems.map(item => item.heading),
            generatedAt: new Date().toISOString()
        };

        const metadataFileName = `podcasts/multi/${newsItemsHash}/metadata.json`;
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
