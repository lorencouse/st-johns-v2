import { describe, expect, test } from "bun:test";
import { postStatusLabel, reviewRequestLabel } from "./status-labels";

describe("postStatusLabel", () => {
  test("uses plain words for every known status", () => {
    expect(postStatusLabel("drafting")).toBe("In progress");
    expect(postStatusLabel("ready_for_review")).toBe("Waiting for approval");
    expect(postStatusLabel("changes_requested")).toBe("Changes requested");
    expect(postStatusLabel("approved")).toBe("Approved");
  });

  test("turns an unknown status into sentence case with spaces", () => {
    expect(postStatusLabel("some_new_state")).toBe("Some new state");
  });
});

describe("reviewRequestLabel", () => {
  test("labels an open request as waiting", () => {
    expect(reviewRequestLabel("open")).toBe("Waiting");
  });
});
