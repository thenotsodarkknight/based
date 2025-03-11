export interface NewsArticle {
    title: string;
    url: string;
    content: string; // Added for clustering and summarization
    bias: string;
}

export interface NewsTopic {
    topic: string;
    summary: string;
    leftLinks: string[];
    rightLinks: string[];
    neutralLinks: string[];
}