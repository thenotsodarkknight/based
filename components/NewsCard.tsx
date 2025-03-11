import React from "react";
import { NewsTopic } from "../types/news";
import Link from "next/link";

interface Props {
    topic: NewsTopic;
}

const NewsCard: React.FC<Props> = ({ topic }) => {
    return (
        <div className="flex flex-col justify-between h-[90vh] w-full max-w-md mx-auto bg-white/10 dark:bg-gray-900/80 backdrop-blur-md rounded-3xl shadow-2xl p-6 transform transition-all duration-300 hover:scale-105 animate-fadeIn">
            <div>
                <h2 className="text-3xl font-bold text-textPrimary leading-tight line-clamp-2">{topic.topic}</h2>
                <p className="mt-4 text-textSecondary text-base leading-relaxed line-clamp-4">{topic.summary}</p>
            </div>
            <div className="mt-6">
                <h3 className="text-xl font-semibold text-textPrimary">Perspectives</h3>
                <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                        <p className="text-leftBias font-medium text-lg">Left</p>
                        {topic.leftLinks.length ? (
                            topic.leftLinks.map((link, idx) => (
                                <a
                                    key={idx}
                                    href={link}
                                    className="text-leftBias text-sm opacity-80 hover:opacity-100 transition-opacity truncate block"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Source {idx + 1}
                                </a>
                            ))
                        ) : (
                            <p className="text-sm text-textSecondary">No sources</p>
                        )}
                    </div>
                    <div>
                        <p className="text-rightBias font-medium text-lg">Right</p>
                        {topic.rightLinks.length ? (
                            topic.rightLinks.map((link, idx) => (
                                <a
                                    key={idx}
                                    href={link}
                                    className="text-rightBias text-sm opacity-80 hover:opacity-100 transition-opacity truncate block"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Source {idx + 1}
                                </a>
                            ))
                        ) : (
                            <p className="text-sm text-textSecondary">No sources</p>
                        )}
                    </div>
                    <div>
                        <p className="text-neutralBias font-medium text-lg">Neutral</p>
                        {topic.neutralLinks.length ? (
                            topic.neutralLinks.map((link, idx) => (
                                <a
                                    key={idx}
                                    href={link}
                                    className="text-neutralBias text-sm opacity-80 hover:opacity-100 transition-opacity truncate block"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Source {idx + 1}
                                </a>
                            ))
                        ) : (
                            <p className="text-sm text-textSecondary">No sources</p>
                        )}
                    </div>
                </div>
            </div>
            <Link href={`/article?topic=${encodeURIComponent(topic.topic)}`}>
                <button className="mt-6 w-full py-3 bg-primary text-white font-semibold rounded-full hover:bg-opacity-90 transition-all">
                    Dive Deeper
                </button>
            </Link>
        </div>
    );
};

const animateFadeIn = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.5s ease-out;
  }
`;

const styleSheet = document.createElement("style");
styleSheet.textContent = animateFadeIn;
document.head.appendChild(styleSheet);

export default NewsCard;