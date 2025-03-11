import { useEffect, useState } from "react";
import NewsFeed from "../components/NewsFeed";
import { NewsTopic } from "../types/news";

export default function Home() {
    const [topics, setTopics] = useState<NewsTopic>([]);
    const [vibe, setVibe] = useState<string>("");
    const [model, setModel] = useState<string>("claude-3-haiku-20240307");
    const [loading, setLoading] = useState<boolean>(false);
    const [isMobile, setIsMobile] = useState<boolean>(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    useEffect(() => {
        const fetchNews = async () => {
            setLoading(true);
            const res = await fetch(`/api/news?vibe=${encodeURIComponent(vibe)}&model=${encodeURIComponent(model)}`);
            const data: NewsTopic = await res.json();
            setTopics(data);
            setLoading(false);
        };
        fetchNews();
    }, [vibe, model]);

    return (
        <div className="min-h-screen relative bg-gradient-to-b from-backgroundDark to-backgroundLight">
            <nav className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-backgroundDark/80 backdrop-blur-sm">
                <h1 className="text-base font-semibold text-primary">based</h1>
                <select
                    onChange={(e) => setVibe(e.target.value)}
                    className="p-2 bg-primary text-white rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm"
                    value={vibe}
                >
                    <option value="">All Vibes</option>
                    <option value="Tech Enthusiast">Tech Enthusiast</option>
                    <option value="Politician">Politician</option>
                    <option value="Athlete">Athlete</option>
                    <option value="Influencer">Influencer</option>
                    <option value="Actor">Actor</option>
                    <option value="Business Leader">Business Leader</option>
                    <option value="Entrepreneur">Entrepreneur</option>
                    <option value="Journalist">Journalist</option>
                    <option value="Academic">Academic</option>
                    <option value="Activist">Activist</option>
                    <option value="Economist">Economist</option>
                    <option value="Cultural Icon">Cultural Icon</option>
                    <option value="Celebrity">Celebrity</option>
                    <option value="Artist">Artist</option>

                </select>
            </nav>

            {loading ? (
                <div className="flex items-center justify-center h-screen">
                    <p className="text-textSecondary text-lg animate-pulse">Loading...</p>
                </div>
            ) : topics.length ? (
                <NewsFeed topics={topics} isMobile={isMobile} />
            ) : (
                <div className="flex items-center justify-center h-screen">
                    <p className="text-textSecondary text-lg">No news found.</p>
                </div>
            )}

            <footer className="fixed bottom-0 left-0 right-0 z-10 p-4 bg-backgroundDark/80 backdrop-blur-sm flex justify-center">
                <select
                    onChange={(e) => setModel(e.target.value)}
                    className="p-2 bg-primary text-white rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm"
                    value={model}
                >
                    <optgroup label="OpenAI">
                        {["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-4o-mini"].map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Anthropic">
                        {["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"].map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </optgroup>
                </select>
            </footer>
        </div>
    );
}