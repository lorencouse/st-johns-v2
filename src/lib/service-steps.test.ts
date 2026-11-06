import { describe, expect, test } from "bun:test";
import { currentServiceStep, serviceStepHref } from "./service-steps";

describe("currentServiceStep", () => {
  test("starts at the video when there are no captions", () => {
    expect(currentServiceStep({ captionsReady: false, projectId: null })).toBe(
      "video"
    );
  });

  test("moves to checking the words once captions exist", () => {
    expect(currentServiceStep({ captionsReady: true, projectId: null })).toBe(
      "words"
    );
  });

  test("goes to the editor once a post has been started", () => {
    expect(currentServiceStep({ captionsReady: true, projectId: "p1" })).toBe(
      "edit"
    );
  });
});

describe("serviceStepHref", () => {
  test("links each step to its page", () => {
    expect(serviceStepHref("stj", "v1", "video", null)).toBe(
      "/w/stj/services/v1"
    );
    expect(serviceStepHref("stj", "v1", "words", null)).toBe(
      "/w/stj/library/v1/review"
    );
    expect(serviceStepHref("stj", "v1", "edit", "p1")).toBe(
      "/w/stj/projects/p1"
    );
    expect(serviceStepHref("stj", "v1", "publish", "p1")).toBe(
      "/w/stj/projects/p1#publish"
    );
  });

  test("has no link for the post steps before a post exists", () => {
    expect(serviceStepHref("stj", "v1", "edit", null)).toBeNull();
    expect(serviceStepHref("stj", "v1", "publish", null)).toBeNull();
  });
});
