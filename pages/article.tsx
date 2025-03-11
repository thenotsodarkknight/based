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
                const content = url; // Ideally fetch full text, but using URL as placeholder
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

                // Fetch summary from Vercel Blob
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

    if (loading) return <p className="p-4">Loading...</p>;
    if (!analysis) return <p className="p-4">No analysis available.</p>;

    return (
        <div className="p-4 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold">Detailed Analysis</h1>
            <p className="mt-2">
                <strong>URL:</strong>{" "}
                <a href={url as string} className="text-blue-500" target="_blank" rel="noopener noreferrer">
                    {url}
                </a>
            </p>
            <p className="mt-2">
                <strong>Leaning:</strong> {analysis.leaning}
            </p>
            <p className="mt-2">
                <strong>Explanation:</strong> {analysis.explanation}
            </p>
            <p className="mt-2">
                <strong>Summary:</strong> {analysis.summary}
            </p>
        </div>
    );
}