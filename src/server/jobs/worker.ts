import type { Job, Worker } from "bullmq";
import { createWorker, JOB_QUEUES } from "./queue";
import { handleChannelSync, type ChannelSyncPayload } from "./handlers/channel-sync";
import { handleVideoIngest, type VideoIngestPayload } from "./handlers/video-ingest";
import { handleDraftGenerate, type DraftGeneratePayload } from "./handlers/draft-generate";
import { handleExportRender, type ExportRenderPayload } from "./handlers/export-render";
import { db } from "@/server/db";
import { appRuns, workspaceVideos, workspaceChannels } from "@/server/db/schema";
import { and, eq, inArray, lt } from "drizzle-orm";

// Runs stuck in queued/running past this are presumed dead (worker killed
// mid-job with retries exhausted) and swept to failed so the UI stops polling.
const STALE_RUN_MINUTES = 60;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

interface BaseJobPayload {
  workspaceId: string;
  runId: string;
}

/** True when BullMQ will not retry this job again. */
function isFinalFailure(job: Job, err: Error) {
  const maxAttempts = job.opts.attempts ?? 1;
  return job.attemptsMade >= maxAttempts || /stalled/i.test(err.message);
}

async function markRunFailed(runId: string, message: string) {
  await db
    .update(appRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      errorMessage: message,
    })
    .where(
      and(eq(appRuns.id, runId), inArray(appRuns.status, ["queued", "running"]))
    );
}

/**
 * Backstop for jobs that fail without their handler's catch running
 * (process killed mid-job, stalled beyond limit) and for final retry
 * exhaustion. Handlers no longer write failure state themselves, so
 * transient attempts don't flicker the run to failed between retries.
 */
function attachFailureHandler<T extends BaseJobPayload>(
  worker: Worker<T>,
  cleanup?: (data: T, message: string) => Promise<void>
) {
  worker.on("failed", async (job, err) => {
    if (!job || !isFinalFailure(job, err)) return;
    try {
      await markRunFailed(job.data.runId, err.message);
      if (cleanup) await cleanup(job.data, err.message);
      console.error(
        `[${worker.name}] Job ${job.id} permanently failed: ${err.message}`
      );
    } catch (backstopErr) {
      console.error(
        `[${worker.name}] Failed to record job failure for run ${job.data.runId}:`,
        backstopErr
      );
    }
  });
}

/** Fail any run that has sat in queued/running long past every retry window. */
export async function sweepStaleRuns() {
  const cutoff = new Date(Date.now() - STALE_RUN_MINUTES * 60 * 1000);
  const swept = await db
    .update(appRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      errorMessage: `Run did not complete within ${STALE_RUN_MINUTES} minutes and was marked failed. It may have been interrupted by a deploy — retry it.`,
    })
    .where(
      and(
        inArray(appRuns.status, ["queued", "running"]),
        lt(appRuns.createdAt, cutoff)
      )
    )
    .returning({ id: appRuns.id });

  if (swept.length > 0) {
    console.warn(`[workers] Swept ${swept.length} stale run(s) to failed`);
  }
}

const workers: Worker[] = [];
let shuttingDown = false;

async function shutdownWorkers(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[workers] ${signal} received, closing workers...`);
  await Promise.allSettled(workers.map((w) => w.close()));
  console.log("[workers] Workers closed");
}

export async function startJobWorkers() {
  console.log("[workers] Starting job workers...");

  const channelSync = createWorker<ChannelSyncPayload>(
    JOB_QUEUES.CHANNEL_SYNC,
    async (job) => {
      console.log(`[channel-sync] Processing job ${job.id}`);
      await handleChannelSync(job.data);
    },
    1
  );
  attachFailureHandler(channelSync, async (data) => {
    // A sync that dies mid-run leaves the junction row stuck on "syncing".
    await db
      .update(workspaceChannels)
      .set({ syncStatus: "error" })
      .where(
        and(
          eq(workspaceChannels.workspaceId, data.workspaceId),
          eq(workspaceChannels.syncStatus, "syncing")
        )
      );
  });

  const videoIngest = createWorker<VideoIngestPayload>(
    JOB_QUEUES.VIDEO_INGEST,
    async (job) => {
      console.log(`[video-ingest] Processing job ${job.id}`);
      await handleVideoIngest(job.data);
    },
    2
  );
  attachFailureHandler(videoIngest, async (data) => {
    await db
      .update(workspaceVideos)
      .set({
        ingestStatus: "ingest_failed",
        lastCaptionsCheckedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceVideos.workspaceId, data.workspaceId),
          eq(workspaceVideos.videoId, data.videoId)
        )
      );
  });

  const draftGenerate = createWorker<DraftGeneratePayload>(
    JOB_QUEUES.DRAFT_GENERATE,
    async (job) => {
      console.log(`[draft-generate] Processing job ${job.id}`);
      await handleDraftGenerate(job.data);
    },
    1
  );
  attachFailureHandler(draftGenerate);

  const exportRender = createWorker<ExportRenderPayload>(
    JOB_QUEUES.EXPORT_RENDER,
    async (job) => {
      console.log(`[export-render] Processing job ${job.id}`);
      await handleExportRender(job.data);
    },
    2
  );
  attachFailureHandler(exportRender);

  workers.push(channelSync, videoIngest, draftGenerate, exportRender);

  process.once("SIGTERM", () => void shutdownWorkers("SIGTERM"));
  process.once("SIGINT", () => void shutdownWorkers("SIGINT"));

  await sweepStaleRuns().catch((err) =>
    console.error("[workers] Stale-run sweep failed:", err)
  );
  setInterval(() => {
    void sweepStaleRuns().catch((err) =>
      console.error("[workers] Stale-run sweep failed:", err)
    );
  }, SWEEP_INTERVAL_MS).unref();

  console.log("[workers] All job workers started");
}
