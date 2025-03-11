import { useEffect, useState } from "react";
import NewsFeed from "../components/NewsFeed";
import { NewsTopic } from "../types/news";

export default function Home() {
    const [topics, setTopics] = useState<NewsTopic[]>([]);
    const [vibe, setVibe] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        const fetchNews = async () => {
            setLoading(true);
            const res = await fetch(`/api/news?vibe=${encodeURIComponent(vibe)}`);
            const data: NewsTopic[] = await res.json();
            setTopics(data);
            setLoading(false);
        };

        fetchNews();
    }, [vibe]);

    return (
        <div className="min-h-screen relative bg-gradient-to-b from-backgroundDark to-backgroundLight">
            <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-10">
                <select
                    onChange={(e) => setVibe(e.target.value)}
                    className="p-3 bg-primary text-white rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    value={vibe}
                >
                    <option value="">All Vibes</option>
                    <option value="Politician">Politician</option>
                    <option value="Tech Enthusiast">Tech Enthusiast</option>
                    <option value="Athlete">Athlete</option>
                    <option value="Influencer">Influencer</option>
                    <option value="Actor">Actor</option>
                </select>
            </div>

            <h1 className="text-5xl font-extrabold text-center pt-24 pb-12 text-textPrimary">Based</h1>

            {loading ? (
                <div className="flex items-center justify-center h-screen">
                    <p className="text-textSecondary text-2xl animate-pulse">Loading...</p>
                </div>
            ) : topics.length ? (
                <NewsFeed topics={topics} />
            ) : (
                <div className="flex items-center justify-center h-screen">
                    <p className="text-textSecondary text-2xl">No topics found.</p>
                </div>
            )}
        </div>
    );
}