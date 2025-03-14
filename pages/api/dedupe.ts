import { NextApiRequest, NextApiResponse } from "next";
import { NewsItem, NewsTopic, BlobMetadata } from "../../types/news";
import { list, del } from "@vercel/blob";

const LEVENSHTEIN_THRESHOLD = 0.8; // Adjust as needed

function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) {
        matrix[i][0] = i;
    }

    for (let j = 0; j <= b.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1, // deletion
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[a.length][b.length];
}

function similarity(a: string, b: string): number {
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 1.0; // Both strings are empty
    const distance = levenshteinDistance(a, b);
    return 1 - distance / maxLength;
}

interface NewsItemWithBlobUrl extends NewsItem {
    _blobUrl?: string; // Track the actual blob URL for deletion
}

async function getAllNewsItems(): Promise<NewsItemWithBlobUrl[]> {
    const { blobs } = await list({
        prefix: "news/global/",
        token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const newsItems: NewsItemWithBlobUrl[] = [];
    for (const blob of blobs) {
        try {
            const response = await fetch(blob.url);
            if (!response.ok) {
                console.error(`Failed to fetch blob: ${blob.url}, status: ${response.status}`);
                continue;
            }
            const newsItem: NewsItem = await response.json();
            // Add the blob URL to the item for deletion later
            newsItems.push({
                ...newsItem,
                _blobUrl: blob.url
            });
        } catch (error: any) {
            console.error(`Error processing blob ${blob.url}:`, error);
        }
    }
    return newsItems;
}

async function deleteBlob(blobUrl: string): Promise<void> {
    try {
        // Delete the blob using the actual URL, not the path
        await del(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
        console.log(`Deleted blob: ${blobUrl}`);
    } catch (error: any) {
        console.error(`Error deleting blob ${blobUrl}:`, error);
        throw error; // Re-throw to handle in the main function
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    try {
        const newsItems = await getAllNewsItems();
        let deletedCount = 0;

        for (let i = 0; i < newsItems.length; i++) {
            for (let j = i + 1; j < newsItems.length; j++) {
                const item1 = newsItems[i];
                const item2 = newsItems[j];

                const sim = similarity(item1.heading, item2.heading);

                if (sim > LEVENSHTEIN_THRESHOLD) {
                    console.log(`Similarity between ${item1.source.url} and ${item2.source.url}: ${sim}`);

                    // Delete the older one
                    const itemToDelete = new Date(item1.lastUpdated) < new Date(item2.lastUpdated) ? item1 : item2;

                    // Use the actual blob URL we stored earlier
                    const blobUrl = itemToDelete._blobUrl;

                    if (!blobUrl) {
                        console.error(`No blob URL found for item: ${itemToDelete.source.url}`);
                        continue;
                    }

                    try {
                        await deleteBlob(blobUrl);
                        deletedCount++;

                        // Also delete the corresponding vibe entries if they exist
                        try {
                            const vibePrefix = `news/personas/`;
                            const { blobs: relatedBlobs } = await list({
                                prefix: vibePrefix,
                                token: process.env.BLOB_READ_WRITE_TOKEN,
                            });

                            // Find and delete any vibe-specific versions
                            const relatedVibeBlobs = relatedBlobs.filter(blob =>
                                blob.pathname.includes(encodeURIComponent(itemToDelete.source.url))
                            );

                            for (const vibeBlob of relatedVibeBlobs) {
                                await del(vibeBlob.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
                                console.log(`Deleted related vibe blob: ${vibeBlob.url}`);
                            }
                        } catch (vibeError) {
                            console.error("Error cleaning up vibe entries:", vibeError);
                        }

                        // Remove the deleted item from newsItems to avoid further comparisons
                        newsItems.splice(newsItems.indexOf(itemToDelete), 1);
                        j--; // Adjust index since we removed an element
                    } catch (deleteError: any) {
                        console.error(`Failed to delete blob for ${itemToDelete.source.url}:`, deleteError);
                    }
                }
            }
        }

        res.status(200).json({ message: "Deduplication complete.", deleted: deletedCount });
    } catch (error: any) {
        console.error("Error during deduplication:", error);
        res.status(500).json({ message: `Deduplication failed: ${error.message}` });
    }
}