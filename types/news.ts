export interface NewsItem {
    heading: string;         // Generated heading for the news
    summary: string;         // Neutral summary of the news
    source: {
        url: string;         // URL of the source article
        name: string;        // Name of the source (e.g., "CNN")
        bias: string;        // "left-leaning", "right-leaning", or "neutral"
        biasExplanation: string; // Brief explanation of the bias
    };
    lastUpdated: string;     // Timestamp of the news
}

export type NewsTopic = NewsItem[]; // Array of news items