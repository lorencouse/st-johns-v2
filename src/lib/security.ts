export function sanitizeLocalRedirectPath(
  value: string | null | undefined,
  fallback = "/app"
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

/**
 * Returns the externally-facing base URL of the current request.
 * Prefers NEXT_PUBLIC_APP_URL (explicit override), then forwarded
 * proxy headers (x-forwarded-proto / x-forwarded-host), then the
 * request's own host header. Only falls back to localhost in dev.
 */
export function getRequestBaseUrl(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
