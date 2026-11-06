/**
 * Rules for the sermon, bulletin and other files staff attach to a service.
 * Shared by the upload form and the upload route so both agree.
 */

export const DOCUMENT_KINDS = ["sermon", "bulletin", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  sermon: "Sermon text or notes",
  bulletin: "Service bulletin",
  other: "Something else",
};

/** 10 MB: enough for a long scanned bulletin or a phone photo. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** How many files one service can hold, so a slip of the finger can't flood it. */
export const MAX_DOCUMENTS_PER_SERVICE = 10;

export type DocumentFormat = "pdf" | "docx" | "text" | "image";

const FORMATS_BY_TYPE: Record<string, DocumentFormat> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "text",
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
};

const FORMATS_BY_EXTENSION: Record<string, DocumentFormat> = {
  pdf: "pdf",
  docx: "docx",
  txt: "text",
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  gif: "image",
};

/** The file picker's accept list. */
export const DOCUMENT_ACCEPT =
  ".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,.gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,image/webp,image/gif";

export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === "string" && (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/**
 * Works out what kind of file this is from its type, falling back to the
 * extension because some browsers send an empty or generic type.
 */
export function documentFormat(
  contentType: string,
  fileName: string
): DocumentFormat | null {
  const byType = FORMATS_BY_TYPE[contentType.split(";")[0].trim().toLowerCase()];
  if (byType) return byType;
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return FORMATS_BY_EXTENSION[ext] ?? null;
}

/** The content type to store, normalised from the format when the browser sent none. */
export function storedContentType(format: DocumentFormat, fileName: string): string {
  if (format === "pdf") return "application/pdf";
  if (format === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (format === "text") return "text/plain";
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

/** A plain-language reason a file can't be added, or null when it's fine. */
export function documentProblem(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_DOCUMENT_BYTES) {
    return "That file is too big. Files can be up to 10 MB.";
  }
  if (!documentFormat(file.type, file.name)) {
    return "We can read PDF, Word (.docx), plain text and photos (JPG, PNG, WebP or GIF).";
  }
  return null;
}

/** A file name safe to use in a storage path, keeping its extension. */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  const trimmed = cleaned.slice(-100);
  return trimmed || "document";
}

/** Where a file lives in the bucket: grouped by workspace and service. */
export function documentStorageKey(
  workspaceId: string,
  videoId: string,
  documentId: string,
  fileName: string
): string {
  return `${workspaceId}/${videoId}/${documentId}-${safeFileName(fileName)}`;
}

/** File sizes the way people read them. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
