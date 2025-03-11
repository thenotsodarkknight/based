import React from "react";
import { NewsArticle } from "../types/news";
import Link from "next/link";

interface Props {
    article: NewsArticle;
}

const NewsCard: React.FC<Props> = ({ article }) => {
    return (
        <div className="p-6 rounded-xl shadow-lg bg-white dark:bg-gray-800 max-w-md mx-auto h-[80vh] flex flex-col justify-between">
            <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{article.title}</h2>
                <p className="mt-2 text-gray-700 dark:text-gray-300">{article.summary}</p>
            </div>
            <div className="mt-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Read More:</h3>
                <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                        <p className="font-medium text-red-500">Left</p>
                        {article.leftLinks.map((link, idx) => (
                            <a key={idx} href={link} className="text-red-400 block truncate" target="_blank" rel="noopener noreferrer">
                                Source {idx + 1}
                            </a>
                        ))}
                    </div>
                    <div>
                        <p className="font-medium text-blue-500">Right</p>
                        {article.rightLinks.map((link, idx) => (
                            <a key={idx} href={link} className="text-blue-400 block truncate" target="_blank" rel="noopener noreferrer">
                                Source {idx + 1}
                            </a>
                        ))}
                    </div>
                    <div>
                        <p className="font-medium text-gray-500">Neutral</p>
                        {article.neutralLinks.map((link, idx) => (
                            <a key={idx} href={link} className="text-gray-400 block truncate" target="_blank" rel="noopener noreferrer">
                                Source {idx + 1}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
            <Link href={`/article?url=${encodeURIComponent(article.url)}`}>
                <button className="mt-4 w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Detailed Analysis
                </button>
            </Link>
        </div>
    );
};

export default NewsCard;