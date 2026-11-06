import { describe, expect, test } from "bun:test";
import { imageFileName, isYouTubeVideoId, parsePublishedUrl } from "./published-url";

describe("parsePublishedUrl", () => {
  test("treats a blank link as no link", () => {
    expect(parsePublishedUrl("  ")).toEqual({ ok: true, url: null });
    expect(parsePublishedUrl(undefined)).toEqual({ ok: true, url: null });
  });

  test("keeps a full https address", () => {
    expect(parsePublishedUrl("https://stjohns.org/blog/all-saints")).toEqual({
      ok: true,
      url: "https://stjohns.org/blog/all-saints",
    });
  });

  test("adds https:// when it was left off", () => {
    expect(parsePublishedUrl("stjohns.org/blog/all-saints")).toEqual({
      ok: true,
      url: "https://stjohns.org/blog/all-saints",
    });
  });

  test("refuses scripts, other schemes and plain words", () => {
    expect(parsePublishedUrl("javascript:alert(1)").ok).toBe(false);
    expect(parsePublishedUrl("ftp://stjohns.org/file").ok).toBe(false);
    expect(parsePublishedUrl("my blog post").ok).toBe(false);
    expect(parsePublishedUrl(42).ok).toBe(false);
  });
});

describe("isYouTubeVideoId", () => {
  test("accepts real ids and rejects anything that could change the URL", () => {
    expect(isYouTubeVideoId("dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeVideoId("../etc/pass")).toBe(false);
    expect(isYouTubeVideoId("short")).toBe(false);
  });
});

describe("imageFileName", () => {
  test("turns the post title into a tidy file name", () => {
    expect(imageFileName("The Great Cloud of Witnesses!")).toBe(
      "the-great-cloud-of-witnesses.jpg"
    );
    expect(imageFileName("Señor, ten piedad")).toBe("senor-ten-piedad.jpg");
    expect(imageFileName("???")).toBe("featured-image.jpg");
  });
});
