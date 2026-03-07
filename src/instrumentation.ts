export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startJobWorkers } = await import("@/server/jobs/worker");
    await startJobWorkers();
  }
}
