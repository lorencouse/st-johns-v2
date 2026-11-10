/** Format seconds to MM:SS or H:MM:SS */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/** Format milliseconds to MM:SS or H:MM:SS */
export function formatTimestampMs(ms: number): string {
  return formatTimestamp(ms / 1000);
}

/** How many whitespace-separated words the text has. */
export function textWordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
