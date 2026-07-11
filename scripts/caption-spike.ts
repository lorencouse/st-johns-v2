/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Caption spike: prove which caption-fetching paths actually work.
 *
 * For each OAuth account with the youtube.force-ssl scope:
 *   1. Which channel does it own? (channels?mine=true)
 *   2. Find livestream VODs among its uploads (liveStreamingDetails.actualEndTime)
 *   3. captions.list + captions.download on owned livestream VODs + a regular upload
 * Then as controls:
 *   4. captions.list/download on a NON-owned video (St. John's NP4jwDD0xFg) — expect 403
 *   5. Unofficial timedtext scrape on the same videos — the potential fallback
 *
 * Run: bun scripts/caption-spike.ts
 * Requires: tunnel to prod Postgres open (scripts/tunnel.sh), .env loaded (bun does this).
 */
import { getGoogleAccessToken } from "../src/server/auth/google-token";
import { parseSrt } from "../src/server/youtube/api";

const YT = "https://www.googleapis.com/youtube/v3";

const USERS = [
  { id: "7559bed1-d94f-49ae-8fb2-517275cd074b", email: "lorenintaiwan@gmail.com" },
  { id: "83338892-c2db-4098-ace9-f5552ed4ccf5", email: "couselm@gmail.com" },
];

const NON_OWNED_CONTROL = "NP4jwDD0xFg"; // St. John's worship livestream, 61 min

interface Result {
  video: string;
  title: string;
  kind: string; // "livestream VOD" | "regular upload" | "non-owned control"
  owner: string;
  tracks: string;
  download: string;
  timedtext: string;
}
const results: Result[] = [];

async function yt(path: string, params: Record<string, string>, token: string) {
  const url = new URL(`${YT}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

async function tryCaptionsApi(videoId: string, token: string) {
  let tracks = "";
  let download = "";
  try {
    const list = await yt("captions", { part: "snippet", videoId }, token);
    const items = list.items ?? [];
    tracks =
      items.length === 0
        ? "none"
        : items
            .map(
              (i: any) =>
                `${i.snippet.language}/${i.snippet.trackKind}${i.snippet.status !== "serving" ? `(${i.snippet.status})` : ""}`
            )
            .join(", ");
    // try to download each track until one succeeds
    for (const item of items) {
      const res = await fetch(`${YT}/captions/${item.id}?tfmt=srt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const srt = await res.text();
        const segs = parseSrt(srt);
        download = `OK via ${item.snippet.language}/${item.snippet.trackKind}: ${srt.length} chars, ${segs.length} segments`;
        break;
      } else {
        const body = (await res.text()).slice(0, 200);
        download += `${item.snippet.language}/${item.snippet.trackKind} -> ${res.status}; `;
        if (res.status === 403 || res.status === 404) continue;
      }
    }
    if (items.length === 0) download = "n/a (no tracks listed)";
  } catch (e: any) {
    if (!tracks) tracks = `LIST FAILED: ${e.message.slice(0, 160)}`;
    if (!download) download = "n/a";
  }
  return { tracks, download };
}

/** Unofficial fallback: scrape the watch page for captionTracks and fetch json3. */
async function tryTimedtext(videoId: string) {
  try {
    const page = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await page.text();
    const m = html.match(/"captionTracks":(\[.*?\])(,"|})/);
    if (!m) return `no captionTracks in watch page (${html.length} bytes)`;
    const tracksJson = JSON.parse(m[1]) as Array<{
      baseUrl: string;
      languageCode: string;
      kind?: string;
    }>;
    const track =
      tracksJson.find((t) => t.languageCode.startsWith("en")) ?? tracksJson[0];
    if (!track) return "captionTracks empty";
    const url = track.baseUrl.replace(/\\u0026/g, "&") + "&fmt=json3";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return `track list OK (${tracksJson.length} tracks) but fetch ${res.status}`;
    const data = await res.json();
    const events = (data.events ?? []).filter((e: any) => e.segs);
    const words = events
      .flatMap((e: any) => e.segs.map((s: any) => s.utf8))
      .join("")
      .split(/\s+/).length;
    return `OK ${track.languageCode}${track.kind === "asr" ? "/ASR" : ""}: ${events.length} events, ~${words} words`;
  } catch (e: any) {
    return `ERROR: ${e.message.slice(0, 120)}`;
  }
}

async function probeVideo(
  videoId: string,
  title: string,
  kind: string,
  owner: string,
  token: string
) {
  console.log(`\n--- ${kind}: "${title}" (${videoId}) [auth: ${owner}]`);
  const api = await tryCaptionsApi(videoId, token);
  console.log(`    captions.list:     ${api.tracks}`);
  console.log(`    captions.download: ${api.download}`);
  const tt = await tryTimedtext(videoId);
  console.log(`    timedtext scrape:  ${tt}`);
  results.push({ video: videoId, title: title.slice(0, 45), kind, owner, tracks: api.tracks, download: api.download, timedtext: tt });
}

for (const user of USERS) {
  console.log(`\n========== ${user.email} ==========`);
  const token = await getGoogleAccessToken(user.id);
  if (!token) {
    console.log("  no valid token (refresh failed or scope missing) — skipping");
    continue;
  }

  const ch = await yt("channels", { part: "snippet,contentDetails", mine: "true" }, token);
  if (!ch.items?.length) {
    console.log("  owns no channel");
    continue;
  }
  const channel = ch.items[0];
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  console.log(`  owns channel: ${channel.snippet.title} (${channel.id}), uploads=${uploads}`);

  // list uploads, classify via liveStreamingDetails
  const pl = await yt(
    "playlistItems",
    { part: "snippet", playlistId: uploads, maxResults: "50" },
    token
  );
  const ids = (pl.items ?? []).map((i: any) => i.snippet.resourceId.videoId);
  if (!ids.length) {
    console.log("  no uploads");
    continue;
  }
  const details = await yt(
    "videos",
    { part: "snippet,liveStreamingDetails,contentDetails", id: ids.join(",") },
    token
  );
  const vods = (details.items ?? []).filter((v: any) => v.liveStreamingDetails?.actualEndTime);
  const regular = (details.items ?? []).filter((v: any) => !v.liveStreamingDetails);
  console.log(`  uploads scanned: ${ids.length} — livestream VODs: ${vods.length}, regular: ${regular.length}`);

  for (const v of vods.slice(0, 2)) {
    await probeVideo(v.id, v.snippet.title, "livestream VOD (owned)", user.email, token);
  }
  if (regular.length) {
    const v = regular[0];
    await probeVideo(v.id, v.snippet.title, "regular upload (owned)", user.email, token);
  }
}

// Non-owned control with the first user that has a token
for (const user of USERS) {
  const token = await getGoogleAccessToken(user.id);
  if (!token) continue;
  await probeVideo(
    NON_OWNED_CONTROL,
    "St. John's Online Worship (livestream)",
    "NON-owned control",
    user.email,
    token
  );
  break;
}

console.log("\n\n================ SUMMARY ================");
for (const r of results) {
  console.log(`\n${r.kind} — ${r.title} (${r.video})`);
  console.log(`  tracks:    ${r.tracks}`);
  console.log(`  download:  ${r.download}`);
  console.log(`  timedtext: ${r.timedtext}`);
}
process.exit(0);
