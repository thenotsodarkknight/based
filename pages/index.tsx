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
        <div className="min-h-screen relative">
            {/* Floating Vibe Selector */}
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-10">
                <select
                    onChange={(e) => setVibe(e.target.value)}
                    className="p-3 bg-primary text-white rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                    <option value="">All Vibes</option>
                    <option value="Tech Enthusiast">Tech Enthusiast</option>
                    <option value="Athlete">Athlete</option>
                    <option value="Influencer">Influencer</option>
                    <option value="Actor">Actor</option>
                </select>
            </div>

            {/* Header */}
            <h1 className="text-4xl font-extrabold text-center pt-20 pb-8">Based</h1>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-screen">
                    <p className="text-textSecondary text-xl animate-pulse">Loading...</p>
                </div>
            ) : articles.length ? (
                <NewsFeed articles={articles} />
            ) : (
                <div className="flex items-center justify-center h-screen">
                    <p className="text-textSecondary text-xl">No articles found.</p>
                </div>
            )}
        </div>
    );
}