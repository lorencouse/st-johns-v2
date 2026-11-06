import { describe, expect, test } from "bun:test";
import {
  continueHref,
  currentServiceStep,
  serviceStepHref,
} from "./service-steps";

const editor = { canEdit: true };
const viewer = { canEdit: false };

describe("currentServiceStep", () => {
  test("starts at the video when there are no captions", () => {
    expect(
      currentServiceStep({ captionsReady: false, projectId: null, ...editor })
    ).toBe("video");
  });

  test("moves to adding documents once captions exist", () => {
    expect(
      currentServiceStep({ captionsReady: true, projectId: null, ...editor })
    ).toBe("documents");
  });

  test("links the documents step for editors only", () => {
    expect(
      serviceStepHref("stj", "v1", "documents", { projectId: null, ...editor })
    ).toBe("/w/stj/services/v1/documents");
    expect(
      serviceStepHref("stj", "v1", "documents", { projectId: null, ...viewer })
    ).toBeNull();
  });

  test("goes to the editor once a post has been started", () => {
    expect(
      currentServiceStep({ captionsReady: true, projectId: "p1", ...editor })
    ).toBe("edit");
    expect(
      currentServiceStep({ captionsReady: true, projectId: "p1", ...viewer })
    ).toBe("edit");
  });

  test("keeps people who cannot edit on the video instead of the words", () => {
    expect(
      currentServiceStep({ captionsReady: true, projectId: null, ...viewer })
    ).toBe("video");
  });
});

describe("serviceStepHref", () => {
  test("links each step to its page", () => {
    expect(
      serviceStepHref("stj", "v1", "video", { projectId: null, ...editor })
    ).toBe("/w/stj/services/v1");
    expect(
      serviceStepHref("stj", "v1", "words", { projectId: null, ...editor })
    ).toBe("/w/stj/library/v1/review");
    expect(
      serviceStepHref("stj", "v1", "edit", { projectId: "p1", ...editor })
    ).toBe("/w/stj/projects/p1");
    expect(
      serviceStepHref("stj", "v1", "publish", { projectId: "p1", ...editor })
    ).toBe("/w/stj/services/v1/publish");
  });

  test("has no link for the post steps before a post exists", () => {
    expect(
      serviceStepHref("stj", "v1", "edit", { projectId: null, ...editor })
    ).toBeNull();
    expect(
      serviceStepHref("stj", "v1", "publish", { projectId: null, ...editor })
    ).toBeNull();
  });

  test("closes checking the words once a post exists", () => {
    expect(
      serviceStepHref("stj", "v1", "words", { projectId: "p1", ...editor })
    ).toBeNull();
  });

  test("never links people who cannot edit to checking the words", () => {
    expect(
      serviceStepHref("stj", "v1", "words", { projectId: null, ...viewer })
    ).toBeNull();
  });
});

describe("continueHref", () => {
  test("sends each person to a page they can open", () => {
    expect(
      continueHref("stj", "v1", { captionsReady: false, projectId: null, ...editor })
    ).toBe("/w/stj/services/v1");
    expect(
      continueHref("stj", "v1", { captionsReady: true, projectId: null, ...editor })
    ).toBe("/w/stj/services/v1/documents");
    expect(
      continueHref("stj", "v1", { captionsReady: true, projectId: null, ...viewer })
    ).toBe("/w/stj/services/v1");
    expect(
      continueHref("stj", "v1", { captionsReady: true, projectId: "p1", ...viewer })
    ).toBe("/w/stj/projects/p1");
  });
});
