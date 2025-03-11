import React from "react";
import { NewsTopic } from "../types/news";

interface Props {
    topic: NewsTopic;
}

const NewsCard: React.FC<Props> = ({ topic }) => {
    return (
        <div className="flex flex-col justify-between h-[90vh] w-full bg-white/20 backdrop-blur-md rounded-xl shadow-xl p-3 mx-auto transform transition-all duration-300 hover:shadow-2xl animate-fadeIn md:max-w-md">
            <div className="space-y-3">
                <h2 className="text-xl font-semibold text-textPrimary">{topic.topic}</h2>
                <p className="text-textSecondary text-xs leading-relaxed">{topic.summary}</p>
                <div className="space-y-2">
                    <h3 className="text-base font-medium text-textPrimary">Sources by Bias</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {topic.leftLinks.length > 0 && (
                            <div className="bg-leftBias/10 p-2 rounded-lg">
                                <h4 className="text-leftBias font-medium text-sm">Left-Leaning</h4>
                                {topic.leftLinks.map((link, idx) => (
                                    <a
                                        key={idx}
                                        href={link}
                                        className="text-leftBias text-xs opacity-80 hover:opacity-100 transition-opacity block truncate"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Source {idx + 1}
                                    </a>
                                ))}
                            </div>
                        )}
                        {topic.rightLinks.length > 0 && (
                            <div className="bg-rightBias/10 p-2 rounded-lg">
                                <h4 className="text-rightBias font-medium text-sm">Right-Leaning</h4>
                                {topic.rightLinks.map((link, idx) => (
                                    <a
                                        key={idx}
                                        href={link}
                                        className="text-rightBias text-xs opacity-80 hover:opacity-100 transition-opacity block truncate"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Source {idx + 1}
                                    </a>
                                ))}
                            </div>
                        )}
                        {topic.neutralLinks.length > 0 && (
                            <div className="bg-neutralBias/10 p-2 rounded-lg">
                                <h4 className="text-neutralBias font-medium text-sm">Neutral</h4>
                                {topic.neutralLinks.map((link, idx) => (
                                    <a
                                        key={idx}
                                        href={link}
                                        className="text-neutralBias text-xs opacity-80 hover:opacity-100 transition-opacity block truncate"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Source {idx + 1}
                                    </a>
                                ))}
                            </div>
                        )}
                        {topic.leftLinks.length === 0 && topic.rightLinks.length === 0 && topic.neutralLinks.length === 0 && (
                            <p className="text-textSecondary text-xs">No sources available.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewsCard;