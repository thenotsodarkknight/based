// pages/api/news/cached.ts
import { NextApiRequest, NextApiResponse } from "next";
import fetchAllCachedNews from "./news";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const cachedNews = await fetchAllCachedNews(req, res);
        res.status(200).json(cachedNews);
    } catch (error: any) {
        console.error("Error fetching cached news:", error);
        res.status(500).json({ error: error.message });
    }
}
