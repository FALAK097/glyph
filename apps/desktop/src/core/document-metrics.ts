export type DocumentMetrics = {
  words: number;
  readTime: number;
  fileSize: string;
};

export function calculateDocumentMetrics(content: string): DocumentMetrics {
  const words = content.split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.round(words / 200));
  const bytes = new TextEncoder().encode(content).length;
  const fileSize = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  return { words, readTime, fileSize };
}
