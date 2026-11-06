import { describe, expect, test } from "bun:test";
import {
  documentFormat,
  documentProblem,
  documentStorageKey,
  formatFileSize,
  isDocumentKind,
  safeFileName,
  storedContentType,
} from "./documents";

describe("documentFormat", () => {
  test("recognises each supported type", () => {
    expect(documentFormat("application/pdf", "a.pdf")).toBe("pdf");
    expect(
      documentFormat(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "a.docx"
      )
    ).toBe("docx");
    expect(documentFormat("text/plain; charset=utf-8", "a.txt")).toBe("text");
    expect(documentFormat("image/jpeg", "photo.jpg")).toBe("image");
  });

  test("falls back to the extension when the browser sends no useful type", () => {
    expect(documentFormat("", "Bulletin Nov 1.PDF")).toBe("pdf");
    expect(documentFormat("application/octet-stream", "notes.docx")).toBe("docx");
  });

  test("refuses formats we cannot read", () => {
    expect(documentFormat("application/msword", "old.doc")).toBeNull();
    expect(documentFormat("application/zip", "files.zip")).toBeNull();
  });
});

describe("documentProblem", () => {
  test("accepts a normal PDF", () => {
    expect(documentProblem({ name: "a.pdf", type: "application/pdf", size: 1000 })).toBeNull();
  });

  test("accepts a file just under 10 MB", () => {
    expect(
      documentProblem({ name: "a.pdf", type: "application/pdf", size: 10 * 1024 * 1024 - 1 })
    ).toBeNull();
  });

  test("explains empty, oversized and unreadable files", () => {
    expect(documentProblem({ name: "a.pdf", type: "application/pdf", size: 0 })).toContain("empty");
    expect(
      documentProblem({ name: "a.pdf", type: "application/pdf", size: 11 * 1024 * 1024 })
    ).toContain("10 MB");
    expect(documentProblem({ name: "a.zip", type: "application/zip", size: 10 })).toContain(
      "PDF"
    );
  });
});

describe("storage names", () => {
  test("makes file names safe for a storage path", () => {
    expect(safeFileName("Sermón notes (final).docx")).toBe("Sermon-notes-final-.docx");
    expect(safeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFileName("???")).toBe("document");
  });

  test("groups files by workspace and service", () => {
    expect(documentStorageKey("ws1", "vid1", "doc1", "Bulletin.pdf")).toBe(
      "ws1/vid1/doc1-Bulletin.pdf"
    );
  });

  test("normalises the stored type from the format", () => {
    expect(storedContentType("image", "photo.PNG")).toBe("image/png");
    expect(storedContentType("pdf", "x")).toBe("application/pdf");
  });
});

describe("helpers", () => {
  test("only knows the three document slots", () => {
    expect(isDocumentKind("sermon")).toBe(true);
    expect(isDocumentKind("bulletin")).toBe(true);
    expect(isDocumentKind("hymns")).toBe(false);
  });

  test("formats sizes for people", () => {
    expect(formatFileSize(500)).toBe("500 bytes");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
