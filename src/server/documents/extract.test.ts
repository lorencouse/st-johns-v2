import { describe, expect, test } from "bun:test";
import { extractDocumentText } from "./extract";

function utf16(text: string, endian: "le" | "be"): ArrayBuffer {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes.set(endian === "le" ? [0xff, 0xfe] : [0xfe, 0xff]);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const [hi, lo] = [code >> 8, code & 0xff];
    bytes.set(endian === "le" ? [lo, hi] : [hi, lo], 2 + i * 2);
  }
  return bytes.buffer;
}

describe("extractDocumentText for plain text", () => {
  test("reads UTF-8 text", async () => {
    const bytes = new TextEncoder().encode("Sermon notes\r\nGrace and peace").buffer;
    expect(await extractDocumentText(bytes, "text", "text/plain")).toBe(
      "Sermon notes\nGrace and peace"
    );
  });

  test("reads a Notepad 'Unicode' (UTF-16 LE) file", async () => {
    const bytes = utf16("Sermon notes\r\nGrace and peace", "le");
    expect(await extractDocumentText(bytes, "text", "text/plain")).toBe(
      "Sermon notes\nGrace and peace"
    );
  });

  test("reads a UTF-16 BE file", async () => {
    const bytes = utf16("Service bulletin", "be");
    expect(await extractDocumentText(bytes, "text", "text/plain")).toBe("Service bulletin");
  });

  test("strips NUL characters, which the database can't store", async () => {
    const bytes = new TextEncoder().encode("Hymn\u0000 list\u0000").buffer;
    const text = await extractDocumentText(bytes, "text", "text/plain");
    expect(text).toBe("Hymn list");
  });

  test("returns null when only NUL characters are left", async () => {
    const bytes = new Uint8Array([0, 0, 0]).buffer;
    expect(await extractDocumentText(bytes, "text", "text/plain")).toBeNull();
  });
});
