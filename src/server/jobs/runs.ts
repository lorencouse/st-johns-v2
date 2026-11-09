import { db } from "@/server/db";
import { appRuns } from "@/server/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

type RunKind = (typeof appRuns.$inferSelect)["kind"];

/** What a run works on. `subjectId` is that record's id. */
type RunSubjectType = "source_video" | "content_project" | "youtube_channel";

/** Records a queued run, ready to be handed to a worker. */
export async function createRun(run: {
  workspaceId: string;
  kind: RunKind;
  subjectType: RunSubjectType;
  subjectId?: string;
  userId: string;
  inputJson?: Record<string, unknown>;
}) {
  const { userId, ...values } = run;
  const [created] = await db
    .insert(appRuns)
    .values({ ...values, status: "queued", triggeredByUserId: userId })
    .returning();
  return created;
}

export async function markRunRunning(runId: string) {
  await db
    .update(appRuns)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(appRuns.id, runId));
}

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
