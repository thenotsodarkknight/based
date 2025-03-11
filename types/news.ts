export interface NewsTopic {
    topic: string;
    summary: string;
    leftLinks: string[];
    rightLinks: string[];
    neutralLinks: string[];
    leaning: string; // Added for bias analysis
    explanation: string; // Added for bias explanation
}