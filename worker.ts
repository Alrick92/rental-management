/**
 * pg-boss worker process.
 * Runs as a separate container (`worker` service in docker-compose.yml).
 * Handles: nightly invoice generation, overdue invoice marking.
 */

import { PgBoss } from "pg-boss";
import { generateInvoices } from "./src/jobs/generate-invoices";
import { markOverdueInvoices } from "./src/jobs/mark-overdue-invoices";

const DATABASE_URL = process.env.DATABASE_URL!;

async function main() {
  console.log("[worker] Starting pg-boss worker...");

  const boss = new PgBoss(DATABASE_URL);

  boss.on("error", (error: unknown) => {
    console.error("[worker] pg-boss error:", error);
  });

  await boss.start();
  console.log("[worker] pg-boss started.");

  // Schedule nightly invoice generation (runs at 02:00 UTC daily)
  await boss.schedule("invoices:generate", "0 2 * * *", undefined, {
    tz: "UTC",
  });
  console.log("[worker] Scheduled invoices:generate (daily at 02:00 UTC)");

  // Schedule overdue invoice marking (runs at 06:00 UTC daily)
  await boss.schedule("invoices:mark-overdue", "0 6 * * *", undefined, {
    tz: "UTC",
  });
  console.log("[worker] Scheduled invoices:mark-overdue (daily at 06:00 UTC)");

  // Register job handlers
  await boss.work("invoices:generate", async (jobs) => {
    console.log(`[worker] Running invoices:generate (${jobs.length} job(s))`);
    const result = await generateInvoices();
    console.log(`[worker] invoices:generate complete: ${result.created} invoices created`);
    return result;
  });

  await boss.work("invoices:mark-overdue", async (jobs) => {
    console.log(`[worker] Running invoices:mark-overdue (${jobs.length} job(s))`);
    const result = await markOverdueInvoices();
    console.log(`[worker] invoices:mark-overdue complete: ${result.marked} invoices marked overdue`);
    return result;
  });

  console.log("[worker] All job handlers registered. Listening for work...");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[worker] Shutting down...");
    await boss.stop();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
