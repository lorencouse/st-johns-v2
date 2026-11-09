import { describe, expect, mock, test } from "bun:test";
import type { NextRequest } from "next/server";

// A signed-in member with the viewer role. The role check runs before any
// other query, so every database call can answer with that one membership.
const membership = [{ workspace: { id: "w1" }, role: "viewer" }];
const anyQuery: Record<string, unknown> = {
  then: (resolve: (rows: typeof membership) => void) => resolve(membership),
};
for (const step of ["select", "from", "innerJoin", "where", "limit"]) {
  anyQuery[step] = () => anyQuery;
}
mock.module("@/server/auth", () => ({
  auth: async () => ({ user: { id: "u1" } }),
}));
mock.module("@/server/db", () => ({ db: anyQuery }));
mock.module("@/server/jobs/queue", () => ({ exportRenderQueue: {} }));

const A = "@/app/api/workspaces/[workspaceId]";
const params = {
  params: Promise.resolve({
    workspaceId: "w1",
    projectId: "p1",
    threadId: "t1",
    videoId: "v1",
    issueId: "i1",
  }),
};
const req = {} as NextRequest;

describe("viewers can only read", () => {
  test.each([
    ["start a comment", `${A}/projects/[projectId]/comments/route`, "POST"],
    ["reply to a comment", `${A}/projects/[projectId]/comments/[threadId]/route`, "POST"],
    ["resolve a comment", `${A}/projects/[projectId]/comments/[threadId]/route`, "PATCH"],
    ["queue an export", `${A}/projects/[projectId]/export/route`, "POST"],
    ["flag an issue", `${A}/videos/[videoId]/issues/route`, "POST"],
    ["resolve an issue", `${A}/videos/[videoId]/issues/[issueId]/route`, "PATCH"],
  ])("cannot %s", async (_action, path, method) => {
    const route = await import(path);
    const res: Response = await route[method](req, params);
    expect(res.status).toBe(403);
  });
});
