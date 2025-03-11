import React from "react";
import { NewsArticle } from "../types/news";
import Link from "next/link";

interface Props {
    article: NewsArticle;
}

const NewsCard: React.FC<Props> = ({ article }) => {
    return (
        <div className="flex flex-col justify-between h-[90vh] w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 transform transition-all duration-300 hover:scale-105">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-textPrimary leading-tight">{article.title}</h2>
                <p className="mt-4 text-textSecondary text-lg">{article.summary}</p>
            </div>

            {/* Links Section */}
            <div className="mt-6">
                <h3 className="text-lg font-semibold text-textPrimary">Perspectives</h3>
                <div className="grid grid-cols-3 gap-4 mt-3">
                    <div>
                        <p className="text-leftBias font-medium">Left</p>
                        {article.leftLinks.map((link, idx) => (
                            <a
                                key={idx}
                                href={link}
                                className="text-leftBias text-sm opacity-80 hover:opacity-100 transition-opacity truncate block"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Source {idx + 1}
                            </a>
                        ))}
                    </div>
                    <div>
                        <p className="text-rightBias font-medium">Right</p>
                        {article.rightLinks.map((link, idx) => (
                            <a
                                key={idx}
                                href={link}
                                className="text-rightBias text-sm opacity-80 hover:opacity-100 transition-opacity truncate block"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Source {idx + 1}
                            </a>
                        ))}
                    </div>
                    <div>
                        <p className="text-neutralBias font-medium">Neutral</p>
                        {article.neutralLinks.map((link, idx) => (
                            <a
                                key={idx}
                                href={link}
                                className="text-neutralBias text-sm opacity-80 hover:opacity-100 transition-opacity truncate block"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Source {idx + 1}
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            {/* Button */}
            <Link href={`/article?url=${encodeURIComponent(article.url)}`}>
                <button className="mt-6 w-full py-3 bg-primary text-white font-semibold rounded-full hover:bg-opacity-90 transition-all">
                    Dive Deeper
                </button>
            </Link>
        </div>
    );
};

export default NewsCard;