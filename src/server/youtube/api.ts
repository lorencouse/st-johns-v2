const YT_API = "https://www.googleapis.com/youtube/v3";

async function ytFetchOAuth(
  path: string,
  params: Record<string, string>,
  accessToken: string
) {
  const url = new URL(`${YT_API}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API error (${res.status}): ${text}`);
  }
  return res.json();
}

// --- Types ---

export interface ChannelInfo {
  youtubeId: string;
  title: string;
  description: string | null;
  handle: string | null;
  thumbnailUrl: string | null;
  uploadsPlaylistId: string | null;
}

export interface PlaylistInfo {
  youtubeId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  itemCount: number;
}

export interface VideoInfo {
  youtubeId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  position: number;
}

// --- Channel ---

export async function fetchMyChannel(
  accessToken: string
): Promise<ChannelInfo> {
  const data = await ytFetchOAuth(
    "channels",
    { part: "snippet,contentDetails", mine: "true" },
    accessToken
  );

  if (!data.items?.length) {
    throw new Error("No YouTube channel found for this account");
  }

  const ch = data.items[0];
  return {
    youtubeId: ch.id,
    title: ch.snippet.title,
    description: ch.snippet.description || null,
    handle: ch.snippet.customUrl || null,
    thumbnailUrl: ch.snippet.thumbnails?.default?.url ?? null,
    uploadsPlaylistId:
      ch.contentDetails?.relatedPlaylists?.uploads ?? null,
  };
}

export async function resolveChannel(
  channelUrl: string,
  accessToken: string
): Promise<ChannelInfo> {
  const url = new URL(channelUrl);
  const path = url.pathname;

  let params: Record<string, string>;

  if (path.startsWith("/channel/")) {
    params = { part: "snippet,contentDetails", id: path.split("/")[2] };
  } else if (path.startsWith("/@")) {
    params = { part: "snippet,contentDetails", forHandle: path.slice(1) };
  } else if (path.startsWith("/user/")) {
    params = {
      part: "snippet,contentDetails",
      forUsername: path.split("/")[2],
    };
  } else if (path.startsWith("/c/")) {
    params = {
      part: "snippet,contentDetails",
      forHandle: path.split("/")[2],
    };
  } else {
    throw new Error(`Unrecognized YouTube channel URL format: ${channelUrl}`);
  }

  const data = await ytFetchOAuth("channels", params, accessToken);

  if (!data.items?.length) {
    throw new Error(`Channel not found for URL: ${channelUrl}`);
  }

  const ch = data.items[0];
  return {
    youtubeId: ch.id,
    title: ch.snippet.title,
    description: ch.snippet.description || null,
    handle: ch.snippet.customUrl || null,
    thumbnailUrl: ch.snippet.thumbnails?.default?.url ?? null,
    uploadsPlaylistId:
      ch.contentDetails?.relatedPlaylists?.uploads ?? null,
  };
}

// --- Playlists ---

export async function fetchChannelPlaylists(
  channelId: string,
  accessToken: string
): Promise<PlaylistInfo[]> {
  const playlists: PlaylistInfo[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "snippet,contentDetails",
      channelId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await ytFetchOAuth("playlists", params, accessToken);

    for (const item of data.items ?? []) {
      playlists.push({
        youtubeId: item.id,
        title: item.snippet.title,
        description: item.snippet.description || null,
        thumbnailUrl: item.snippet.thumbnails?.default?.url ?? null,
        itemCount: item.contentDetails?.itemCount ?? 0,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return playlists;
}

// --- Videos ---

function parseDuration(iso8601: string): number | null {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  return (
    (parseInt(match[1] || "0") * 3600) +
    (parseInt(match[2] || "0") * 60) +
    parseInt(match[3] || "0")
  );
}

export async function fetchPlaylistVideos(
  playlistId: string,
  accessToken: string
): Promise<VideoInfo[]> {
  const videos: VideoInfo[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "snippet",
      playlistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await ytFetchOAuth("playlistItems", params, accessToken);

    for (const item of data.items ?? []) {
      if (
        item.snippet.title === "Deleted video" ||
        item.snippet.title === "Private video"
      ) {
        continue;
      }
      videos.push({
        youtubeId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        description: item.snippet.description || null,
        thumbnailUrl: item.snippet.thumbnails?.default?.url ?? null,
        publishedAt: item.snippet.publishedAt || null,
        durationSeconds: null, // playlistItems doesn't include duration
        position: item.snippet.position,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return videos;
}

export async function fetchVideoDetails(
  videoIds: string[],
  accessToken: string
): Promise<Map<string, { durationSeconds: number | null; publishedAt: string | null; description: string | null }>> {
  const result = new Map<string, { durationSeconds: number | null; publishedAt: string | null; description: string | null }>();

  // YouTube API allows up to 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await ytFetchOAuth(
      "videos",
      {
        part: "contentDetails,snippet",
        id: batch.join(","),
      },
      accessToken
    );

    for (const item of data.items ?? []) {
      result.set(item.id, {
        durationSeconds: item.contentDetails?.duration
          ? parseDuration(item.contentDetails.duration)
          : null,
        publishedAt: item.snippet?.publishedAt || null,
        description: item.snippet?.description || null,
      });
    }
  }

  return result;
}

// --- Captions ---

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

export function parseSrt(srt: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  const blocks = srt.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const tsMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!tsMatch) continue;

    const start =
      parseInt(tsMatch[1]) * 3600 +
      parseInt(tsMatch[2]) * 60 +
      parseInt(tsMatch[3]) +
      parseInt(tsMatch[4]) / 1000;
    const end =
      parseInt(tsMatch[5]) * 3600 +
      parseInt(tsMatch[6]) * 60 +
      parseInt(tsMatch[7]) +
      parseInt(tsMatch[8]) / 1000;

    const text = lines
      .slice(2)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (text) {
      segments.push({ start, end, text });
    }
  }

  return segments;
}

export async function fetchCaptions(
  videoId: string,
  _accessToken?: string
): Promise<CaptionSegment[]> {
  // Fetch caption track list from YouTube's public timedtext endpoint
  const listUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const pageRes = await fetch(listUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!pageRes.ok) {
    throw new Error(`Failed to fetch YouTube page (${pageRes.status})`);
  }

  const html = await pageRes.text();

  // Extract caption tracks from the page's player response
  const captionMatch = html.match(
    /"captions":\s*(\{"playerCaptionsTracklistRenderer":\{[^}]*"captionTracks":\[.*?\])/
  );

  if (!captionMatch) {
    throw new Error("No caption tracks found for this video");
  }

  // Parse the caption tracks JSON
  const tracksMatch = captionMatch[1].match(
    /"captionTracks":(\[.*?\])/
  );

  if (!tracksMatch) {
    throw new Error("Failed to parse caption tracks");
  }

  let tracks: Array<{
    baseUrl: string;
    languageCode: string;
    kind?: string;
    name?: { simpleText?: string };
  }>;

  try {
    tracks = JSON.parse(tracksMatch[1]);
  } catch {
    throw new Error("Failed to parse caption tracks JSON");
  }

  if (tracks.length === 0) {
    throw new Error("No caption tracks found for this video");
  }

  // Find best English track
  const englishCodes = ["en", "en-US", "en-GB"];
  let bestTrack: (typeof tracks)[0] | null = null;

  // Prefer manual English captions
  for (const track of tracks) {
    if (
      englishCodes.includes(track.languageCode) &&
      track.kind !== "asr"
    ) {
      bestTrack = track;
      break;
    }
  }

  // Fall back to ASR English
  if (!bestTrack) {
    for (const track of tracks) {
      if (
        englishCodes.includes(track.languageCode) &&
        track.kind === "asr"
      ) {
        bestTrack = track;
        break;
      }
    }
  }

  // Any English-like
  if (!bestTrack) {
    for (const track of tracks) {
      if (track.languageCode.startsWith("en")) {
        bestTrack = track;
        break;
      }
    }
  }

  // Last resort: first track
  if (!bestTrack) {
    bestTrack = tracks[0];
  }

  // Download as SRT (fmt=3 = SRT format)
  const srtUrl = `${bestTrack.baseUrl}&fmt=3`;
  const dlRes = await fetch(srtUrl);

  if (!dlRes.ok) {
    const body = await dlRes.text();
    throw new Error(`Caption download failed (${dlRes.status}): ${body}`);
  }

  const srt = await dlRes.text();
  const segments = parseSrt(srt);

  if (segments.length === 0) {
    throw new Error("Downloaded captions but parsed 0 segments");
  }

  return segments;
}
