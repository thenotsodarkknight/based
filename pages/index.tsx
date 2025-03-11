import { useEffect, useState } from "react";
import NewsFeed from "../components/NewsFeed";
import { NewsTopic } from "../types/news";

export default function Home() {
    const [topics, setTopics] = useState<NewsTopic[]>([]);
    const [vibe, setVibe] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [isMobile, setIsMobile] = useState<boolean>(false);

    useEffect(() => {
        // Detect mobile device
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768); // 768px is a common mobile breakpoint
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

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
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-10">
                <select
                    onChange={(e) => setVibe(e.target.value)}
                    className="p-2 bg-primary text-white rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm"
                    value={vibe}
                >
                    <option value="">All Vibes</option>
                    <option value="Tech Enthusiast">Tech Enthusiast</option>
                    <option value="Athlete">Athlete</option>
                    <option value="Influencer">Influencer</option>
                    <option value="Actor">Actor</option>
                </select>
            </div>

            <h1 className="text-3xl font-extrabold text-center pt-16 pb-8 text-textPrimary">Based</h1>

            {loading ? (
                <div className="flex items-center justify-center h-screen">
                    <p className="text-textSecondary text-lg animate-pulse">Loading...</p>
                </div>
            ) : topics.length ? (
                <NewsFeed topics={topics} isMobile={isMobile} />
            ) : (
                <div className="flex items-center justify-center h-screen">
                    <p className="text-textSecondary text-lg">No topics found.</p>
                </div>
            )}
        </div>
    );
}