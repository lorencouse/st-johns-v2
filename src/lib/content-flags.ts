/**
 * Flags potentially inappropriate transcription errors in church livestream captions.
 * YouTube auto-captions sometimes produce offensive-sounding text from misheard words.
 * Words that legitimately appear in scripture/sermons (hell, damn, kill, etc.) are excluded.
 */

const FLAGGED_PATTERNS: RegExp[] = [
  // Profanity
  /\bf+u+c+k\w*/i,
  /\bs+h+i+t\w*/i,
  /\basshole\w*/i,
  /\bbitch\w*/i,
  /\bbastard\w*/i,
  /\bcrap\b/i,
  /\bpiss\w*/i,

  // Sexual terms
  /\bporn\w*/i,
  /\bsex(?:ual|ually|ting|y)\b/i,
  /\borgas\w+/i,
  /\brape[ds]?\b/i,
  /\bmasturbat\w*/i,
  /\bgenital\w*/i,
  /\berect(?:ion|ions)\b/i,
  /\bslut\w*/i,
  /\bwhore\w*/i,

  // Slurs (broad patterns)
  /\bn+i+g+(?:er|a|ah|as)\w*/i,
  /\bfagg?\w*/i,
  /\bretard\w*/i,
  /\bspic\b/i,
  /\bchink\b/i,
  /\btranny\b/i,

  // Graphic violence (beyond biblical context)
  /\bmurder(?:ed|ing|s)?\b/i,
  /\bslaught(?:er|ered|ering)\b/i,
  /\bsuicid\w*/i,
  /\bmassacr\w*/i,
  /\bbehead\w*/i,
  /\btortur\w*/i,
  /\bmutilat\w*/i,

  // Drug references (likely mishearing)
  /\bcocaine\b/i,
  /\bheroin\b/i,
  /\bmethamphet\w*/i,
  /\bmarijuana\b/i,

  // Common auto-caption mishearings in church context
  /\bsacrific\w*\s+(?:your\s+)?kids?\b/i,
  /\bstrip\w*\s+(?:for|down)\b/i,
];

/**
 * Words that trip a pattern above but are perfectly ordinary here, so the
 * patterns can stay deliberately broad without crying wolf. Place names are
 * the main offender: the slur pattern matches "Nigeria" letter for letter.
 */
const ALLOWED_WORDS =
  /^(?:niger|nigerian?s?|niggardly|assess(?:ed|ing|ment\w*)?)$/i;

/**
 * Scans text for flagged content patterns.
 * Returns array of matched words/phrases (empty if clean).
 *
 * These are review hints for a human, not censorship: a sermon legitimately
 * discusses murder, torture and slaughter, so a flag means "look at this",
 * never "remove it".
 */
export function flagContent(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of FLAGGED_PATTERNS) {
    const match = text.match(pattern);
    if (match && !ALLOWED_WORDS.test(match[0].trim())) {
      matches.push(match[0]);
    }
  }
  return matches;
}
