/**
 * Swaps the first occurrence of `original` for `suggestion`. Returns null when
 * the words are no longer there, because the person already edited them.
 */
export function applySpot(text: string, original: string, suggestion: string): string | null {
  const at = text.indexOf(original);
  if (at === -1) return null;
  return text.slice(0, at) + suggestion + text.slice(at + original.length);
}
