import { createWorker, JOB_QUEUES } from "./queue";

export async function startJobWorkers() {
  console.log("[workers] Starting job workers...");

  createWorker(
    JOB_QUEUES.CHANNEL_SYNC,
    async (job) => {
      console.log(`[channel-sync] Processing job ${job.id}`, job.data);
      // TODO: implement channel sync handler
    },
    1
  );

  createWorker(
    JOB_QUEUES.VIDEO_INGEST,
    async (job) => {
      console.log(`[video-ingest] Processing job ${job.id}`, job.data);
      // TODO: implement video ingest handler
    },
    2
  );

  createWorker(
    JOB_QUEUES.TRANSCRIPT_PROCESS,
    async (job) => {
      console.log(`[transcript] Processing job ${job.id}`, job.data);
      // TODO: implement transcript processing handler
    },
    2
  );

  createWorker(
    JOB_QUEUES.DRAFT_GENERATE,
    async (job) => {
      console.log(`[draft-generate] Processing job ${job.id}`, job.data);
      // TODO: implement draft generation handler
    },
    1
  );

  createWorker(
    JOB_QUEUES.EXPORT_RENDER,
    async (job) => {
      console.log(`[export-render] Processing job ${job.id}`, job.data);
      // TODO: implement export render handler
    },
    2
  );

  console.log("[workers] All job workers started");
}
