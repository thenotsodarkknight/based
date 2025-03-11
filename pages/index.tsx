import { useEffect, useState } from "react";
import NewsFeed from "../components/NewsFeed";
import { NewsArticle } from "../types/news";

export default function Home() {
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [vibe, setVibe] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        const fetchNews = async () => {
            setLoading(true);
            const res = await fetch(`/api/news?vibe=${encodeURIComponent(vibe)}`);
            const data: NewsArticle[] = await res.json();
            setArticles(data);
            setLoading(false);
        };

        fetchNews();
    }, [vibe]);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Based - LLM News</h1>
            <select
                onChange={(e) => setVibe(e.target.value)}
                className="mt-2 p-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
                <option value="">All News</option>
                <option value="Tech Enthusiast">Tech Enthusiast</option>
                <option value="Athlete">Athlete</option>
                <option value="Influencer">Influencer</option>
                <option value="Actor">Actor</option>
            </select>
            {loading ? (
                <p className="mt-4 text-gray-700 dark:text-gray-300">Loading...</p>
            ) : articles.length ? (
                <NewsFeed articles={articles} />
            ) : (
                <p className="mt-4 text-gray-700 dark:text-gray-300">No articles found.</p>
            )}
        </div>
    );
}