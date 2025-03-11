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
    const { topic } = router.query as { topic?: string };
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!topic) {
            setLoading(false);
            setAnalysis(null);
            return;
        }

        const fetchAnalysis = async () => {
            try {
                // Fetch the topic summary from Vercel Blob
                const cacheKey = `summaries/topic_${encodeURIComponent(topic)}.txt`;
                let summary = "Summary not available";
                try {
                    const blobHead = await head(cacheKey, {
                        token: process.env.BLOB_READ_WRITE_TOKEN,
                    });
                    if (blobHead) {
                        const response = await fetch(blobHead.url);
                        summary = await response.text();
                    }
                } catch (blobError) {
                    console.error("Error fetching summary from Blob:", blobError);
                }

                // Analyze the topic for bias and explanation
                const response = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: `Classify the overall political leaning of this news topic as left-leaning, right-leaning, or neutral, and provide a brief explanation: ${summary}`,
                        },
                    ],
                });

                const result = response.choices[0].message.content;
                const [leaning, ...explanation] = result.split("\n");

                setAnalysis({ leaning, explanation: explanation.join("\n"), summary });
            } catch (error) {
                console.error("Error in fetchAnalysis:", error);
                setAnalysis({ leaning: "Unknown", explanation: "Failed to analyze", summary: "Summary not available" });
            } finally {
                setLoading(false);
            }
        };

        fetchAnalysis();
    }, [topic]);

    if (loading)
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-b from-backgroundDark to-backgroundLight">
                <p className="text-textSecondary text-2xl animate-pulse">Loading...</p>
            </div>
        );
    if (!analysis)
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-b from-backgroundDark to-backgroundLight">
                <p className="text-textSecondary text-2xl">No analysis available.</p>
            </div>
        );

    return (
        <div className="min-h-screen bg-gradient-to-b from-backgroundDark to-backgroundLight flex items-center justify-center">
            <div className="max-w-2xl w-full bg-white/10 dark:bg-gray-900/80 backdrop-blur-md rounded-3xl shadow-2xl p-8 animate-fadeIn">
                <h1 className="text-4xl font-bold text-textPrimary">{topic} - Detailed Analysis</h1>
                <div className="mt-6 space-y-6">
                    <p className="text-textSecondary">
                        <strong>Leaning:</strong> <span className="text-textPrimary">{analysis.leaning}</span>
                    </p>
                    <p className="text-textSecondary">
                        <strong>Explanation:</strong> <span className="text-textPrimary">{analysis.explanation}</span>
                    </p>
                    <p className="text-textSecondary">
                        <strong>Summary:</strong> <span className="text-textPrimary">{analysis.summary}</span>
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