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
}

export type NewsTopic = NewsItem[];

// Define the type for blob metadata returned by list()
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