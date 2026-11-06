/**
 * Checks the live-post address someone pastes after publishing. Blank is
 * fine (the link is optional); anything else must be an http(s) address.
 */
export function parsePublishedUrl(
  input: unknown
): { ok: true; url: string | null } | { ok: false; error: string } {
  if (input === undefined || input === null) return { ok: true, url: null };
  if (typeof input !== "string") {
    return { ok: false, error: "The link must be text." };
  }
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, url: null };
  if (trimmed.length > 2000) {
    return { ok: false, error: "That link is too long." };
  }
  // People often paste "stjohns.org/blog/..." without the scheme.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: "That doesn't look like a web address." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Use a web address starting with https://" };
  }
  if (!parsed.hostname.includes(".")) {
    return { ok: false, error: "That doesn't look like a web address." };
  }
  return { ok: true, url: parsed.toString() };
}

/** YouTube video ids are 11 characters of letters, digits, "-" and "_". */
export function isYouTubeVideoId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

/** A file name for the featured image, from the post title. */
export function imageFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${slug || "featured-image"}.jpg`;
}
