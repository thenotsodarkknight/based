export interface NewsItem {
    heading: string;
    summary: string;
    source: {
        url: string;
        name: string;
        bias: string;
        biasExplanation: string;
    };
    lastUpdated: string;
    modelUsed: string; // Track the AI model used
}

export type NewsTopic = NewsItem[];

export interface BlobMetadata {
    url: string;
    pathname: string;
    size: number;
    uploadedAt: Date;
    contentType: string;
    contentDisposition: string;
    downloadUrl: string;
    cacheControl?: string;
}