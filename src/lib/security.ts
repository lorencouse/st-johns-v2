export function sanitizeLocalRedirectPath(
  value: string | null | undefined,
  fallback = "/app"
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
