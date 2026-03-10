/**
 * Flags potentially inappropriate transcription errors in church livestream captions.
 * YouTube auto-captions sometimes produce offensive-sounding text from misheard words.
 */

const FLAGGED_PATTERNS: RegExp[] = [
  /\bf+u+c+k\w*/i,
  /\bs+h+i+t\w*/i,
  /\bass(?:es|hole\w*)?\b/i,
  /\bbitch\w*/i,
  /\bbastard\w*/i,
  /\bcrap\b/i,
  /\bpiss\w*/i,
  /\bporn\w*/i,
  /\bsex(?:ual|ually|ting|y)\b/i,
  /\borgas\w+/i,
  /\brape[ds]?\b/i,
  /\bmasturbat\w*/i,
  /\bslut\w*/i,
  /\bwhore\w*/i,
  /\bn+i+g+(?:er|a|ah|as)\w*/i,
  /\bfagg?\w*/i,
  /\bretard\w*/i,
  /\bmurder(?:ed|ing|s)?\b/i,
  /\bslaught(?:er|ered|ering)\b/i,
  /\bsuicid\w*/i,
  /\bmassacr\w*/i,
  /\btortur\w*/i,
  /\bcocaine\b/i,
  /\bheroin\b/i,
  /\bmethamphet\w*/i,
];

export function flagContent(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of FLAGGED_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }
  return matches;
}
