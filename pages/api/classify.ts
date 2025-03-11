import { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { content } = req.body;

    try {
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
        res.status(200).json({ leaning: leaning.trim(), explanation: explanation.join("\n").trim() });
    } catch (error) {
        console.error("Error classifying article:", error);
        res.status(500).json({ error: "Failed to classify article" });
    }
}
