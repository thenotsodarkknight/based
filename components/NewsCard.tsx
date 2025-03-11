import React from "react";
import { NewsTopic } from "../types/news";

interface Props {
    topic: NewsTopic;
}

const NewsCard: React.FC<Props> = ({ topic }) => {
    return (
        <div className="flex flex-col justify-between h-[90vh] w-full bg-white/10 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg p-4 mx-auto transform transition-all duration-300 hover:scale-105 animate-fadeIn md:max-w-md">
            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-textPrimary leading-tight line-clamp-2">{topic.topic}</h2>
                <p className="text-textSecondary text-sm leading-relaxed line-clamp-4">{topic.summary}</p>
                <div>
                    <h3 className="text-lg font-semibold text-textPrimary">Analysis</h3>
                    <p className="text-textSecondary text-sm">
                        <strong>Leaning:</strong> {topic.leaning}
                    </p>
                    <p className="text-textSecondary text-sm">
                        <strong>Explanation:</strong> {topic.explanation}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default NewsCard;