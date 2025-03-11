import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import OpenAI from "openai";
import { head } from "@vercel/blob";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface Analysis {
    leaning: string;
    explanation: string;
    summary: string;
}

export default function ArticleDetail() {
    const router = useRouter();
    const { url } = router.query;
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        if (url) {
            const fetchAnalysis = async () => {
                setLoading(true);
                const content = url;
                const response = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: `Classify the political leaning of this article as left-leaning, right-leaning, or neutral, and provide a brief explanation: ${content}`,
                        },
                    ],
                });

                const result = response.choices[0].message.content;
                const [leaning, ...explanation] = result.split("\n");

                const cacheKey = `summaries/${encodeURIComponent(url as string)}.txt`;
                let summary = "Summary not available";
                try {
                    const blobHead = await head(cacheKey, {
                        token: process.env.BLOB_READ_WRITE_TOKEN,
                    });
                    if (blobHead) {
                        const response = await fetch(blobHead.url);
                        summary = await response.text();
                    }
                } catch (error) {
                    console.error("Error fetching summary from Blob:", error);
                }

                setAnalysis({ leaning, explanation: explanation.join("\n"), summary });
                setLoading(false);
            };
            fetchAnalysis();
        }
    }, [url]);

    if (loading)
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-textSecondary text-xl animate-pulse">Loading...</p>
            </div>
        );
    if (!analysis)
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-textSecondary text-xl">No analysis available.</p>
            </div>
        );

    return (
        <div className="min-h-screen p-6 flex items-center justify-center">
            <div className="max-w-2xl w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8">
                <h1 className="text-3xl font-bold text-textPrimary">Detailed Analysis</h1>
                <div className="mt-6 space-y-4">
                    <p>
                        <strong className="text-textSecondary">URL:</strong>{" "}
                        <a href={url as string} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                            {url}
                        </a>
                    </p>
                    <p>
                        <strong className="text-textSecondary">Leaning:</strong>{" "}
                        <span className="text-textPrimary">{analysis.leaning}</span>
                    </p>
                    <p>
                        <strong className="text-textSecondary">Explanation:</strong>{" "}
                        <span className="text-textPrimary">{analysis.explanation}</span>
                    </p>
                    <p>
                        <strong className="text-textSecondary">Summary:</strong>{" "}
                        <span className="text-textPrimary">{analysis.summary}</span>
                    </p>
                </div>
                <button
                    onClick={() => router.back()}
                    className="mt-6 w-full py-3 bg-primary text-white font-semibold rounded-full hover:bg-opacity-90 transition-all"
                >
                    Back to Feed
                </button>
            </div>
        </div>
    );
}