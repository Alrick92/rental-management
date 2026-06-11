/**
 * pg-boss worker process.
 * Runs as a separate container (`worker` service in docker-compose.yml).
 * Phase 1: stub. Phase 3+ will add jobs for invoice rollup, reminders, etc.
 */

async function main() {
  console.log("[worker] Starting pg-boss worker...");
  console.log("[worker] No jobs registered yet (Phase 1 stub).");
  console.log("[worker] Worker is idle. Jobs will be added in later phases.");

  // Keep the process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
