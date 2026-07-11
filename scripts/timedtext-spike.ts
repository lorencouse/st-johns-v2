/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Standalone probe of the unofficial timedtext caption path (no OAuth needed).
 * Run: bun scripts/timedtext-spike.ts
 */
const VIDEOS = [
  { id: "NP4jwDD0xFg", note: "St. John's worship livestream, 61 min" },
  { id: "HuklT5xVYWY", note: "Transitaku Taipei Brown Line, 43 min" },
  { id: "IibGURxA87E", note: "Loren LGBTQ Boston Outreach, 26 min" },
  { id: "FdBJ6fxgEuU", note: "Wedding 2018, 23 min" },
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

for (const v of VIDEOS) {
  console.log(`\n=== ${v.id} — ${v.note}`);
  try {
    const page = await fetch(`https://www.youtube.com/watch?v=${v.id}&hl=en`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    const html = await page.text();
    const m = html.match(/"captionTracks":(\[.*?\])(,"|})/);
    if (!m) {
      console.log(`  no captionTracks found in watch page (${html.length} bytes, status ${page.status})`);
      continue;
    }
    const tracks = JSON.parse(m[1]) as Array<{
      baseUrl: string;
      languageCode: string;
      kind?: string;
      name?: { runs?: Array<{ text: string }> };
    }>;
    console.log(
      `  tracks: ${tracks.map((t) => `${t.languageCode}${t.kind === "asr" ? "/ASR" : "/manual"}`).join(", ")}`
    );
    const track = tracks.find((t) => t.languageCode.startsWith("en")) ?? tracks[0];
    const url = track.baseUrl.replace(/\\u0026/g, "&") + "&fmt=json3";
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      console.log(`  json3 fetch failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    const body = await res.text();
    if (!body.trim()) {
      console.log(`  json3 fetch returned EMPTY body (status 200) — timedtext blocked/expired`);
      continue;
    }
    const data = JSON.parse(body);
    const events = (data.events ?? []).filter((e: any) => e.segs);
    const text = events.flatMap((e: any) => e.segs.map((s: any) => s.utf8)).join("");
    const words = text.split(/\s+/).filter(Boolean).length;
    const lastMs = events.length ? events[events.length - 1].tStartMs : 0;
    console.log(
      `  json3 OK: ${events.length} events, ~${words} words, coverage to ${(lastMs / 60000).toFixed(1)} min`
    );
    console.log(`  sample: "${text.slice(0, 180).replace(/\n/g, " ")}..."`);
  } catch (e: any) {
    console.log(`  ERROR: ${e.message.slice(0, 200)}`);
  }
}
process.exit(0);

export {};
