import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getOpenAIClient } from "@/server/ai/openai";
import type { CaptionSegment } from "./api";

const execFileAsync = promisify(execFile);
const TMP_DIR = "/tmp/audio";

/**
 * Download audio from a YouTube video using yt-dlp and transcribe with OpenAI Whisper.
 * Returns caption segments compatible with the existing pipeline.
 */
export async function transcribeWithWhisper(
  videoId: string
): Promise<CaptionSegment[]> {
  const fileId = randomUUID();
  const outputPath = join(TMP_DIR, `${fileId}.mp3`);

  try {
    // 1. Download audio with yt-dlp (low bitrate to stay under Whisper's 25MB limit)
    console.log(`[whisper] Downloading audio for ${videoId}`);
    await execFileAsync("yt-dlp", [
      "--no-check-certificates",
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "9", // lowest quality (~48kbps), keeps file small
      "--no-playlist",
      "--max-filesize", "24m",
      "-o", outputPath,
      `https://www.youtube.com/watch?v=${videoId}`,
    ], { timeout: 120_000 });

    // 2. Read the file
    const audioBuffer = await readFile(outputPath);
    console.log(`[whisper] Audio downloaded: ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB`);

    if (audioBuffer.length > 25 * 1024 * 1024) {
      throw new Error("Audio file exceeds Whisper's 25MB limit");
    }

    // 3. Send to OpenAI Whisper
    console.log(`[whisper] Transcribing ${videoId} with Whisper`);
    const client = getOpenAIClient();
    const file = new File([audioBuffer], `${videoId}.mp3`, { type: "audio/mpeg" });

    const transcription = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    // 4. Convert to CaptionSegment format
    const segments: CaptionSegment[] = (transcription.segments ?? []).map(
      (seg: { start: number; end: number; text: string }) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      })
    );

    console.log(`[whisper] Transcribed ${videoId}: ${segments.length} segments`);
    return segments;
  } finally {
    // Cleanup temp file
    try {
      await unlink(outputPath);
    } catch {
      // ignore
    }
  }
}
