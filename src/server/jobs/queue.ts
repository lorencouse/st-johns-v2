import { Queue, Worker, type Job } from "bullmq";

const redisConnection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

export const JOB_QUEUES = {
  CHANNEL_SYNC: "channel-sync",
  VIDEO_INGEST: "video-ingest",
  TRANSCRIPT_PROCESS: "transcript-process",
  DRAFT_GENERATE: "draft-generate",
  EXPORT_RENDER: "export-render",
} as const;

function parseConnection() {
  const url = new URL(redisConnection.url);
  return {
    host: url.hostname,
    port: parseInt(url.port || "6379"),
    password: url.password || undefined,
  };
}

export function createQueue(name: string) {
  return new Queue(name, { connection: parseConnection() });
}

export function createWorker<T>(
  name: string,
  processor: (job: Job<T>) => Promise<void>,
  concurrency = 1
) {
  return new Worker<T>(name, processor, {
    connection: parseConnection(),
    concurrency,
  });
}

export const channelSyncQueue = createQueue(JOB_QUEUES.CHANNEL_SYNC);
export const videoIngestQueue = createQueue(JOB_QUEUES.VIDEO_INGEST);
export const transcriptProcessQueue = createQueue(JOB_QUEUES.TRANSCRIPT_PROCESS);
export const draftGenerateQueue = createQueue(JOB_QUEUES.DRAFT_GENERATE);
export const exportRenderQueue = createQueue(JOB_QUEUES.EXPORT_RENDER);
