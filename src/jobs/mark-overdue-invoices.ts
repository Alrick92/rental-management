/**
 * Marks unpaid invoices as overdue when their due date has passed.
 * Runs daily to update invoice statuses.
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createWorkerPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter }) as unknown as import("@/generated/prisma/client").PrismaClient;
}

const GRACE_PERIOD_DAYS = 5;

export async function markOverdueInvoices(): Promise<{ marked: number }> {
  const prisma = createWorkerPrisma();

  try {
    const graceCutoff = new Date();
    graceCutoff.setUTCHours(0, 0, 0, 0);
    graceCutoff.setUTCDate(graceCutoff.getUTCDate() - GRACE_PERIOD_DAYS);

    const result = await prisma.invoice.updateMany({
      where: {
        status: { in: ["draft", "sent", "partially_paid"] },
        dueDate: { lt: graceCutoff },
      },
      data: { status: "overdue" },
    });

    return { marked: result.count };
  } finally {
    await prisma.$disconnect();
  }
}
