import { describe, expect, test } from "bun:test";
import { blockIndexFromId, isPostField, locateText } from "./post-spots";

describe("locateText", () => {
  test("finds a phrase inside one run", () => {
    expect(locateText([{ text: "From Isiah forty.", pos: 10 }], "Isiah")).toEqual({ from: 15, to: 20 });
  });

  test("finds a phrase that crosses runs, such as plain then bold text", () => {
    // "Father " (plain) at 1, then "Mikel" (bold) at 8
    const runs = [
      { text: "Father ", pos: 1 },
      { text: "Mikel", pos: 8 },
      { text: " prayed.", pos: 13 },
    ];
    expect(locateText(runs, "Father Mikel")).toEqual({ from: 1, to: 13 });
    expect(locateText(runs, "Mikel prayed")).toEqual({ from: 8, to: 20 });
  });

  test("uses each run's own position when runs are not contiguous", () => {
    // A gap between runs, as a line break leaves.
    const runs = [
      { text: "Hymn ", pos: 1 },
      { text: "four twenty", pos: 7 },
    ];
    expect(locateText(runs, "four twenty")).toEqual({ from: 7, to: 18 });
  });

  test("returns null when the words are gone", () => {
    expect(locateText([{ text: "Isaiah 40", pos: 1 }], "Isiah")).toBeNull();
    expect(locateText([], "Isiah")).toBeNull();
    expect(locateText([{ text: "x", pos: 1 }], "")).toBeNull();
  });
});

describe("spot ids", () => {
  test("tells plain fields from body blocks", () => {
    expect(isPostField("title")).toBe(true);
    expect(isPostField("b3")).toBe(false);
    expect(blockIndexFromId("b12")).toBe(12);
    expect(blockIndexFromId("title")).toBeNull();
  });
});
