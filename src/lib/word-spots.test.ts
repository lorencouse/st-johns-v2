import { describe, expect, test } from "bun:test";
import { applySpot } from "./word-spots";

describe("applySpot", () => {
  test("replaces only the first occurrence", () => {
    expect(applySpot("Isiah said, Isiah wrote", "Isiah", "Isaiah")).toBe("Isaiah said, Isiah wrote");
  });

  test("returns null when the words were already changed", () => {
    expect(applySpot("Isaiah said", "Isiah", "Isaiah")).toBeNull();
  });
});
