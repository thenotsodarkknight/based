import { useEffect, useState } from "react";
import NewsFeed from "../components/NewsFeed";
import { NewsTopic, NewsItem } from "../types/news";

interface PodcastData {
    title: string;
    summary: string;
    audioUrl: string;
}

export default function Home() {
    const [topics, setTopics] = useState<NewsTopic>([]);
    const [vibe, setVibe] = useState<string>("");
    const [model, setModel] = useState<string>("o3-mini");
    const [loading, setLoading] = useState<boolean>(false);
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [showPopup, setShowPopup] = useState<boolean>(false);
    const [showFeaturePopup, setShowFeaturePopup] = useState<boolean>(false);
    const [podcastLoading, setPodcastLoading] = useState<boolean>(false);
    const [podcast, setPodcast] = useState<PodcastData | null>(null);

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
            if (res.status === 429) {
                setShowPopup(true);
                setTimeout(() => setShowPopup(false), 4000); // Hide popup after 4 seconds
            }
            setTopics(data);
            setLoading(false);
        };
        fetchNews();
    }, [vibe, model]);

    const handlePodcastClick = async () => {
        if (topics.length === 0) {
            setShowFeaturePopup(true);
            setTimeout(() => setShowFeaturePopup(false), 2000);
            return;
        }

        setPodcastLoading(true);
        try {
            // Send up to 5 news items from the current feed
            const selectedNewsItems = topics.slice(0, 5);

            const response = await fetch('/api/fetch/podcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ newsItems: selectedNewsItems }),
            });

            if (!response.ok) {
                throw new Error('Podcast generation failed');
            }

            const podcastData = await response.json();
            setPodcast(podcastData);
        } catch (error) {
            console.error('Error generating podcast:', error);
            // Use fallback podcast in case of error
            setPodcast({
                title: "<i>podcasts</i> by <i>based</i>",
                summary: "A discussion of the news and current events on your current feed with expert analysis and commentary. Right now this feature is rolled back due to lack of storage-resources / funds for APIs. Here is a sample podcast instead.",
                audioUrl: "https://6g3cqvnbmy1tir2l.public.blob.vercel-storage.com/podcasts/sample/base_podcast_demo-q2kHMwPFbk0hV2aYgNqnOi8r2paiRm.mp3"
            });
        } finally {
            setPodcastLoading(false);
        }
    };

    const closePodcast = () => {
        setPodcast(null);
    };

    return (
        <div className="min-h-screen relative bg-gradient-to-b from-backgroundDark to-backgroundLight">
            <nav className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-backgroundDark/80 backdrop-blur-sm" style={{ zIndex: 1 }}>
                <h1 className="text-xl p-1 font-semibold text-primary" onClick={() => setVibe("")}>based</h1>
                <select
                    onChange={(e) => setVibe(e.target.value)}
                    className="p-2 bg-primary font-semibold text-white rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm"
                    value={vibe}
                >
                    <option value="">All Roles</option>
                    <option value="Tech Enthusiast">Tech Enthusiast</option>
                    <option value="Politician">Politician</option>
                    <option value="Athlete">Athlete</option>
                    <option value="Influencer">Influencer</option>
                    <option value="Actor">Actor</option>
                    <option value="Business Leader">Business Leader</option>
                    <option value="Entrepreneur">Entrepreneur</option>
                    <option value="Journalist">Journalist</option>
                    <option value="Academic">Academic</option>
                    <option value="Lawyer">Lawyer</option>
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

            {podcast && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-primary">{podcast.title}</h2>
                            <button
                                onClick={closePodcast}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-gray-700 mb-4">{podcast.summary}</p>
                        <audio controls className="w-full">
                            <source src={podcast.audioUrl} type="audio/mpeg" />
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                </div>
            )}

            {showPopup && (
                <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 font-8xs text-white p-4 rounded-lg shadow-lg transition-opacity duration-400" style={{ zIndex: 10 }}>
                    NewsAPI Daily Token Limit Reached: This app is just for a weekend project, so a free tier is being used. Populating with cached news items.
                </div>
            )}

            {showFeaturePopup && (
                <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-yellow-500 font-8xs text-white p-4 rounded-lg shadow-lg transition-opacity duration-400" style={{ zIndex: 10 }}>
                    Feature in development
                </div>
            )}

            <footer className="fixed bottom-0 opacity-100 bg-gradient-to-b to-backgroundDark from-backgroundLight/20 left-0 right-0 z-10 p-4 flex justify-center space-x-4">
                <div className="flex flex-col items-center">
                    <button
                        className={`p-2 font-semibold ${podcastLoading ? 'bg-gray-300' : 'bg-white'} text-primary rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm`}
                        onClick={handlePodcastClick}
                        disabled={podcastLoading}
                    >
                        {podcastLoading ? 'Generating...' : 'Generate Podcast'}
                    </button>
                </div>
            </footer>
        </div>
    );
}