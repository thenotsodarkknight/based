import { useEffect, useState, useRef } from "react";
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

    // Audio player states
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1);
    const audioRef = useRef<HTMLAudioElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);

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
        // if (topics.length === 0) {
        //     setShowFeaturePopup(true);
        //     setTimeout(() => setShowFeaturePopup(false), 2000);
        //     return;
        // }

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
                title: "podcasts by based",
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

    // Handle play/pause toggle
    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    // Handle time update
    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    // Handle loading metadata
    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    // Handle volume change
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    };

    // Handle progress bar click
    const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (progressBarRef.current && audioRef.current) {
            const rect = progressBarRef.current.getBoundingClientRect();
            const position = (e.clientX - rect.left) / rect.width;
            const newTime = position * duration;
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    // Format time function (converts seconds to mm:ss format)
    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
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
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-2xl w-85 mx-4 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-primary">{podcast.title}</h2>
                            <button
                                onClick={closePodcast}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 mb-6">{podcast.summary}</p>

                        {/* Custom Audio Player */}
                        <div className="p-1 rounded-lg">
                            {/* Hidden native audio element */}
                            <audio
                                ref={audioRef}
                                src={podcast.audioUrl}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={handleLoadedMetadata}
                                onEnded={() => setIsPlaying(false)}
                            />

                            <audio controls className="w-full">
                                <source src={podcast.audioUrl} type="audio/mpeg" />
                                Your browser does not support the audio element.
                            </audio>

                            {/* Player Controls */}
                            {/* <div className="flex items-center justify-between mb-3">
                                <button
                                    onClick={togglePlay}
                                    className="w-12 h-12 rounded-full flex items-center justify-center bg-primary hover:bg-purple-600 transition-colors"
                                >
                                    {isPlaying ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                </button>

                                <div className="flex items-center space-x-4 flex-1 mx-4">
                                    <span className="text-xs text-gray-600 dark:text-gray-400 w-10">{formatTime(currentTime)}</span>

                            //         {/* Progress Bar 
                            //         <div
                            //             className="h-2 flex-1 rounded-full bg-gray-300 dark:bg-gray-700 relative cursor-pointer"
                            //             onClick={handleProgressBarClick}
                            //             ref={progressBarRef}
                            //         >
                            //             <div
                            //                 className="absolute h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                            //                 style={{ width: `${(currentTime / duration) * 100}%` }}
                            //             ></div>
                            //             <div
                            //                 className="absolute h-4 w-4 bg-white dark:bg-gray-200 rounded-full shadow-md -top-1"
                            //                 style={{
                            //                     left: `calc(${(currentTime / duration) * 100}% - 8px)`,
                            //                     display: duration ? 'block' : 'none'
                            //                 }}
                            //             ></div>
                            //         </div>

                            //         <span className="text-xs text-gray-600 dark:text-gray-400 w-10">{formatTime(duration)}</span>
                            //     </div>

                            //     <div className="flex items-center w-28">
                            //         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            //             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414-7.072m-2.828 9.9a9 9 0 010-12.728" />
                            //         </svg>
                            //         <input
                            //             type="range"
                            //             min="0"
                            //             max="1"
                            //             step="0.01"
                            //             value={volume}
                            //             onChange={handleVolumeChange}
                            //             className="w-full h-2 ml-2 rounded-lg appearance-none bg-gray-300 dark:bg-gray-700 focus:outline-none"
                            //         />
                            //     </div>
                            // </div> */}
                        </div>
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

            <footer className="fixed bottom-0 opacity-100 bg-gradient-to-b to-backgroundDark from-backgroundLight/20 left-0 right-0 z-10 pb-8 pt-4 px-4 flex justify-center space-x-4" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 24px))' }}>
                <div className="flex flex-col items-center w-full max-w-xs">
                    <button
                        className={`p-3 w-full font-semibold ${podcastLoading ? 'bg-gray-300' : 'bg-white'} text-primary rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary text-sm`}
                        onClick={handlePodcastClick}
                        disabled={podcastLoading}
                        style={{ minHeight: '50px' }}
                    >
                        {podcastLoading ? 'Generating...' : 'Generate Podcast'}
                    </button>
                </div>
            </footer>
        </div>
    );
}