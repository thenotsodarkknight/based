import React from "react";
import { NewsItem } from "../types/news"; // Use NewsItem instead of NewsTopic

interface Props {
    newsItem: NewsItem; // Renamed from topic to newsItem for clarity
}

const NewsCard: React.FC<Props> = ({ newsItem }) => {
    const biasColor = {
        "left-leaning": "text-leftBias bg-leftBias/10",
        "right-leaning": "text-leftBias bg-leftBias/10",
        neutral: "text-neutralBias bg-neutralBias/10",
    }[newsItem.source.bias] || "text-rightBias bg-rightBias/10";

    return (
        <div className="flex flex-col justify-between h-[78vh] w-[90vw] bg-[#333333]/50 backdrop-blur-md rounded-xl p-3 mx-auto transform transition-all duration-300 hover:bg-[#333333]/70 animate-fadeIn md:max-w-md border border-[#444444]">
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-textPrimary">{newsItem.heading}</h2>
                <p className="text-textSecondary text-xs leading-relaxed">{newsItem.summary}</p>
                <div className="space-y-2">
                    <h3 className="text-base font-medium text-textPrimary">Source</h3>
                    <div className={`p-2 rounded-lg ${biasColor}`}>
                        <h4 className="font-medium text-sm capitalize">
                            {newsItem.source.bias} - {newsItem.source.name}
                        </h4>
                        <a
                            href={newsItem.source.url}
                            className="text-xs opacity-80 hover:opacity-100 transition-opacity block truncate"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {newsItem.source.url}
                        </a>
                        <p className="text-xs mt-1">{newsItem.source.biasExplanation}</p>
                    </div>
                </div>
            </div>
            <div className="text-xs text-textSecondary">
                <strong>Last Updated:</strong> {new Date(new Date(newsItem.lastUpdated).setDate(new Date(newsItem.lastUpdated).getDate() + 2)).toDateString()}
            </div>
        </div>
    );
};

export default NewsCard;