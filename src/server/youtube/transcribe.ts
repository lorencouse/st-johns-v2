import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, readdir, mkdtemp, rm, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { getOpenAIClient } from "@/server/ai/openai";
import type { CaptionSegment } from "./api";
import { assertUsableSpeech } from "./speech-quality";

const execFileAsync = promisify(execFile);

/**
 * Whisper rejects uploads over 25MB. A full worship service is far longer
 * than that at any usable bitrate, so audio is split into fixed-length
 * chunks and each chunk's timestamps are shifted back into place.
 */
const CHUNK_SECONDS = 600; // 10 minutes
const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

const DOWNLOAD_TIMEOUT_MS = 600_000;
const FFMPEG_TIMEOUT_MS = 300_000;

/**
 * Download audio from a YouTube video using yt-dlp and transcribe with
 * OpenAI Whisper. Used as a fallback for videos that have no caption track.
 *
 * Returns caption segments compatible with the existing pipeline.
 */
export async function transcribeWithWhisper(
  videoId: string
): Promise<CaptionSegment[]> {
  const dir = await mkdtemp(join(tmpdir(), `whisper-${videoId}-`));
  const audioPath = join(dir, "audio.mp3");

  try {
    // 1. Download audio. Low bitrate keeps chunks comfortably under the
    //    upload limit; Whisper is not sensitive to it for speech.
    console.log(`[whisper] Downloading audio for ${videoId}`);
    await execFileAsync(
      "yt-dlp",
      [
        "--no-check-certificates",
        "--no-playlist",
        "--no-warnings",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "9",
        "-o", audioPath,
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      { timeout: DOWNLOAD_TIMEOUT_MS }
    );

    const { size } = await stat(audioPath);
    console.log(`[whisper] Audio: ${(size / 1024 / 1024).toFixed(1)}MB`);

    // 2. Split into chunks ffmpeg can cut without re-encoding.
    await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner", "-loglevel", "error",
        "-i", audioPath,
        "-f", "segment",
        "-segment_time", String(CHUNK_SECONDS),
        "-c", "copy",
        join(dir, "chunk-%03d.mp3"),
      ],
      { timeout: FFMPEG_TIMEOUT_MS }
    );

    const chunks = (await readdir(dir))
      .filter((f) => f.startsWith("chunk-") && f.endsWith(".mp3"))
      .sort();

    if (chunks.length === 0) {
      throw new Error("ffmpeg produced no audio chunks");
    }
    console.log(`[whisper] Transcribing ${chunks.length} chunk(s)`);

    // 3. Transcribe each chunk, shifting timestamps by the chunk's offset.
    const client = getOpenAIClient();
    const segments: CaptionSegment[] = [];

    for (const [index, name] of chunks.entries()) {
      const chunkPath = join(dir, name);
      const buffer = await readFile(chunkPath);

      if (buffer.length > WHISPER_MAX_BYTES) {
        throw new Error(
          `Audio chunk ${name} is ${(buffer.length / 1024 / 1024).toFixed(1)}MB, ` +
            `over Whisper's 25MB limit. Lower CHUNK_SECONDS.`
        );
      }

      const offset = index * CHUNK_SECONDS;
      const file = new File([buffer as unknown as BlobPart], name, {
        type: "audio/mpeg",
      });

      const transcription = await client.audio.transcriptions.create({
        file,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });

      for (const seg of transcription.segments ?? []) {
        const text = seg.text.trim();
        if (!text) continue;
        segments.push({
          start: seg.start + offset,
          end: seg.end + offset,
          text,
        });
      }

      console.log(`[whisper]   chunk ${index + 1}/${chunks.length} done`);
    }

    // Drop the filler whisper emits over non-speech audio, then make sure
    // what is left is actually a transcript. Without this a silent or
    // music-only stream yields hundreds of "you" segments that look like a
    // successful ingest and only fail much later, at draft time.
    const speech = assertUsableSpeech(segments, videoId);

    console.log(
      `[whisper] Transcribed ${videoId}: ${speech.length} segments` +
        (speech.length < segments.length
          ? ` (dropped ${segments.length - speech.length} non-speech)`
          : "")
    );
    return speech;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
