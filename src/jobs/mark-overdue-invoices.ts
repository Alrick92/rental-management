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

export async function markOverdueInvoices(): Promise<{ marked: number }> {
  const prisma = createWorkerPrisma();

  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const result = await prisma.invoice.updateMany({
      where: {
        status: { in: ["draft", "sent"] },
        dueDate: { lt: today },
      },
      data: { status: "overdue" },
    });

    return { marked: result.count };
  } finally {
    await prisma.$disconnect();
  }
}
