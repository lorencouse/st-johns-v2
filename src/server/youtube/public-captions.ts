import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, readdir, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parseSrt, type CaptionSegment } from "./api";

const execFileAsync = promisify(execFile);

const YT_DLP_TIMEOUT_MS = 120_000;

/**
 * Language codes to try, in order of preference. "en-orig" is YouTube's
 * original-audio track: for an English service it is the real transcript,
 * whereas a bare "en" may be a machine translation of some other track.
 */
const LANG_PRIORITY = ["en-orig", "en", "en-US", "en-GB"];

export type CaptionKind = "manual" | "asr";

export interface PublicCaptionResult {
  segments: CaptionSegment[];
  kind: CaptionKind;
  languageCode: string;
}

/** Thrown when the video simply has no usable English caption track. */
export class NoCaptionsError extends Error {
  constructor(videoId: string) {
    super(`No English caption track available for ${videoId}`);
    this.name = "NoCaptionsError";
  }
}

function isMissingYtDlp(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "ENOENT"
  );
}

/**
 * Run yt-dlp to write subtitle files into `dir`. `auto` selects the
 * auto-generated (ASR) tracks rather than human-uploaded ones.
 */
async function downloadSubs(
  videoId: string,
  dir: string,
  auto: boolean
): Promise<void> {
  const args = [
    "--skip-download",
    "--no-playlist",
    "--no-warnings",
    auto ? "--write-auto-subs" : "--write-subs",
    ...(auto ? ["--no-write-subs"] : ["--no-write-auto-subs"]),
    "--sub-langs",
    LANG_PRIORITY.join(","),
    "--sub-format",
    "srt/vtt/best",
    "--convert-subs",
    "srt",
    "-o",
    join(dir, "%(id)s.%(ext)s"),
    `https://www.youtube.com/watch?v=${videoId}`,
  ];

  try {
    await execFileAsync("yt-dlp", args, { timeout: YT_DLP_TIMEOUT_MS });
  } catch (err) {
    if (isMissingYtDlp(err)) {
      throw new Error(
        "yt-dlp is not installed. Install it with `brew install yt-dlp`."
      );
    }
    // yt-dlp exits non-zero for some videos even after writing a usable
    // subtitle file, so swallow here and let the caller decide based on
    // which files actually landed on disk.
  }
}

/**
 * Pick the best subtitle file that yt-dlp wrote, honouring LANG_PRIORITY.
 * Files are named `<videoId>.<lang>.srt`.
 */
function pickBestFile(files: string[]): { file: string; lang: string } | null {
  const srtFiles = files.filter((f) => f.endsWith(".srt"));
  for (const lang of LANG_PRIORITY) {
    const match = srtFiles.find((f) => f.endsWith(`.${lang}.srt`));
    if (match) return { file: match, lang };
  }
  // Any other English-ish track yt-dlp happened to write.
  const fallback = srtFiles.find((f) => /\.en[-.]/i.test(f));
  if (fallback) {
    const parts = fallback.split(".");
    return { file: fallback, lang: parts[parts.length - 2] ?? "en" };
  }
  return null;
}

/**
 * Fetch captions for any PUBLIC YouTube video using yt-dlp.
 *
 * Unlike `fetchCaptions` in ./api.ts — which calls the YouTube Data API's
 * captions.download endpoint and therefore only works for videos on a
 * channel the OAuth user owns — this works for any public video. That is
 * what we need for channels we do not administer.
 *
 * Prefers human-uploaded captions, falling back to YouTube's ASR track.
 */
export async function fetchPublicCaptions(
  videoId: string
): Promise<PublicCaptionResult> {
  const dir = await mkdtemp(join(tmpdir(), `yt-captions-${videoId}-`));

  try {
    for (const auto of [false, true]) {
      await downloadSubs(videoId, dir, auto);

      const best = pickBestFile(await readdir(dir));
      if (!best) continue;

      const srt = await readFile(join(dir, best.file), "utf8");
      const segments = parseSrt(srt);
      if (segments.length === 0) continue;

      const kind: CaptionKind = auto ? "asr" : "manual";
      console.log(
        `[public-captions] ${videoId}: ${segments.length} segments ` +
          `(${kind}, ${best.lang}), ends at ${segments[segments.length - 1].end.toFixed(0)}s`
      );
      return { segments, kind, languageCode: best.lang };
    }

    throw new NoCaptionsError(videoId);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
