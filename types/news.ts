export interface NewsTopic {
    topic: string;
    summary: string; // Neutral summary based on all links
    leftLinks: string[];
    rightLinks: string[];
    neutralLinks: string[];
}