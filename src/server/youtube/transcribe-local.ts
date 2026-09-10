import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, mkdtemp, mkdir, rm, access } from "fs/promises";
import { join, isAbsolute } from "path";
import { parseSrt, type CaptionSegment } from "./api";
import { assertUsableSpeech } from "./speech-quality";

const execFileAsync = promisify(execFile);

/**
 * Local Whisper via whisper.cpp, Metal-accelerated on Apple Silicon.
 *
 * Preferred over the hosted API in ./transcribe.ts: it costs nothing, has no
 * upload limit (so no chunking), and large-v3-turbo is a newer model than the
 * API's whisper-1, which is large-v2.
 *
 * Requires `brew install whisper-cpp` and a GGML model file.
 */

/** Model file, relative to the project root unless an absolute path is given. */
const MODEL_PATH =
  process.env.WHISPER_MODEL_PATH ?? "models/ggml-large-v3-turbo.bin";

/**
 * Scratch space for audio. Deliberately NOT os.tmpdir(): that lives on the
 * boot volume, which is nearly full on this machine, while the project volume
 * has plenty of room. Override with WHISPER_TMP_DIR.
 */
const TMP_ROOT = process.env.WHISPER_TMP_DIR ?? ".tmp";

/** whisper.cpp wants 16 kHz mono PCM. */
const SAMPLE_RATE = "16000";

const DOWNLOAD_TIMEOUT_MS = 600_000;
const TRANSCRIBE_TIMEOUT_MS = 3_600_000;

function resolveFromRoot(path: string): string {
  return isAbsolute(path) ? path : join(process.cwd(), path);
}

async function assertModelPresent(modelPath: string): Promise<void> {
  try {
    await access(modelPath);
  } catch {
    throw new Error(
      `Whisper model not found at ${modelPath}. Download one with:\n` +
        `  curl -L -o ${MODEL_PATH} \\\n` +
        `    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin\n` +
        `Or point WHISPER_MODEL_PATH at an existing model.`
    );
  }
}

function isMissingBinary(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "ENOENT"
  );
}

/**
 * Download a video's audio and transcribe it locally with whisper.cpp.
 * Returns caption segments compatible with the rest of the pipeline.
 */
export async function transcribeLocally(
  videoId: string
): Promise<CaptionSegment[]> {
  const modelPath = resolveFromRoot(MODEL_PATH);
  await assertModelPresent(modelPath);

  const tmpRoot = resolveFromRoot(TMP_ROOT);
  await mkdir(tmpRoot, { recursive: true });
  const dir = await mkdtemp(join(tmpRoot, `whisper-${videoId}-`));

  const wavPath = join(dir, "audio.wav");
  const outPrefix = join(dir, "out");

  try {
    // 1. Download audio straight to the sample rate whisper.cpp expects.
    console.log(`[whisper-local] Downloading audio for ${videoId}`);
    await execFileAsync(
      "yt-dlp",
      [
        "--no-check-certificates",
        "--no-playlist",
        "--no-warnings",
        "-x",
        "--audio-format", "wav",
        "--postprocessor-args", `ffmpeg:-ar ${SAMPLE_RATE} -ac 1`,
        "-o", wavPath,
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      { timeout: DOWNLOAD_TIMEOUT_MS }
    );

    // 2. Transcribe. whisper.cpp uses Metal automatically on Apple Silicon;
    //    threads are capped at the performance cores since the GPU does the
    //    heavy lifting and the efficiency cores only add contention.
    console.log(`[whisper-local] Transcribing ${videoId}`);
    const started = Date.now();

    try {
      await execFileAsync(
        "whisper-cli",
        [
          "-m", modelPath,
          "-f", wavPath,
          "-l", "en",
          "-t", "4",
          "--output-srt",
          "--output-file", outPrefix,
          "--print-progress",
        ],
        { timeout: TRANSCRIBE_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 }
      );
    } catch (err) {
      if (isMissingBinary(err)) {
        throw new Error(
          "whisper-cli is not installed. Install it with `brew install whisper-cpp`."
        );
      }
      throw err;
    }

    const elapsed = ((Date.now() - started) / 1000).toFixed(0);

    // 3. Reuse the same SRT parser the yt-dlp caption path uses.
    const srt = await readFile(`${outPrefix}.srt`, "utf8");
    const segments = parseSrt(srt);

    if (segments.length === 0) {
      throw new Error(`whisper.cpp produced no segments for ${videoId}`);
    }

    const speech = assertUsableSpeech(segments, videoId);
    const dropped = segments.length - speech.length;

    console.log(
      `[whisper-local] ${videoId}: ${speech.length} segments in ${elapsed}s` +
        (dropped > 0 ? ` (dropped ${dropped} non-speech)` : "")
    );

    return speech;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
