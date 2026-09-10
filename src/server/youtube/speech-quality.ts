import type { CaptionSegment } from "./api";

/**
 * Phrases Whisper emits when handed silence or music. Rather than returning
 * nothing, it repeats one of these for the length of the file — so a
 * silent stream looks like a successful transcription until something
 * downstream tries to use it. Applies to the hosted API and local models
 * alike; it is a property of the model, not the runtime.
 */
const HALLUCINATION_RE =
  /^(?:you|thank you|thanks for watching|bye|so|music|okay|\.|\?)[.!?]*$/i;

/** Minimum distinct utterances before we believe a transcript is real. */
const MIN_DISTINCT_UTTERANCES = 5;

/**
 * Drop Whisper's non-speech filler and verify what remains is a real
 * transcript. Throws when the audio was effectively silent or music-only,
 * so the caller records an honest failure instead of an empty transcript.
 */
export function assertUsableSpeech(
  segments: CaptionSegment[],
  videoId: string
): CaptionSegment[] {
  const speech = segments.filter(
    (seg) => !HALLUCINATION_RE.test(seg.text.trim())
  );
  const distinct = new Set(speech.map((seg) => seg.text.trim().toLowerCase()));

  if (speech.length === 0 || distinct.size < MIN_DISTINCT_UTTERANCES) {
    throw new Error(
      `Whisper found no usable speech in ${videoId} ` +
        `(${segments.length} segments, ${distinct.size} distinct). ` +
        `The audio is probably silent or music-only.`
    );
  }

  return speech;
}

/** How many segments assertUsableSpeech would discard, for logging. */
export function countNonSpeech(
  segments: CaptionSegment[],
  kept: CaptionSegment[]
): number {
  return segments.length - kept.length;
}
