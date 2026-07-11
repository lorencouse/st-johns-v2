import { db } from "@/server/db";
import { appRuns } from "@/server/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

type RunKind = (typeof appRuns.$inferSelect)["kind"];

/**
 * Find a queued/running run for the same subject so duplicate triggers
 * (double-clicks, concurrent requests) attach to the in-flight run instead
 * of enqueueing a second job.
 */
export async function findActiveRun(
  workspaceId: string,
  kind: RunKind,
  subjectId: string | null
) {
  const [run] = await db
    .select({ id: appRuns.id })
    .from(appRuns)
    .where(
      and(
        eq(appRuns.workspaceId, workspaceId),
        eq(appRuns.kind, kind),
        subjectId === null
          ? isNull(appRuns.subjectId)
          : eq(appRuns.subjectId, subjectId),
        inArray(appRuns.status, ["queued", "running"])
      )
    )
    .orderBy(desc(appRuns.createdAt))
    .limit(1);

  return run ?? null;
}
