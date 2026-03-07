import { createWorker, JOB_QUEUES } from "./queue";
import { handleChannelSync, type ChannelSyncPayload } from "./handlers/channel-sync";
import { handleVideoIngest, type VideoIngestPayload } from "./handlers/video-ingest";
import { handleDraftGenerate, type DraftGeneratePayload } from "./handlers/draft-generate";
import { handleExportRender, type ExportRenderPayload } from "./handlers/export-render";

export async function startJobWorkers() {
  console.log("[workers] Starting job workers...");

  createWorker<ChannelSyncPayload>(
    JOB_QUEUES.CHANNEL_SYNC,
    async (job) => {
      console.log(`[channel-sync] Processing job ${job.id}`);
      await handleChannelSync(job.data);
    },
    1
  );

  createWorker<VideoIngestPayload>(
    JOB_QUEUES.VIDEO_INGEST,
    async (job) => {
      console.log(`[video-ingest] Processing job ${job.id}`);
      await handleVideoIngest(job.data);
    },
    2
  );

  createWorker<DraftGeneratePayload>(
    JOB_QUEUES.DRAFT_GENERATE,
    async (job) => {
      console.log(`[draft-generate] Processing job ${job.id}`);
      await handleDraftGenerate(job.data);
    },
    1
  );

  createWorker<ExportRenderPayload>(
    JOB_QUEUES.EXPORT_RENDER,
    async (job) => {
      console.log(`[export-render] Processing job ${job.id}`);
      await handleExportRender(job.data);
    },
    2
  );

  console.log("[workers] All job workers started");
}
