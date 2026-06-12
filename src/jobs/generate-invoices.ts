/**
 * Nightly invoice generation job.
 * For each active/signed lease, generates a monthly invoice if one doesn't exist
 * for the current billing period.
 *
 * Logic:
 * 1. Find all leases with status 'active' or 'signed'
 * 2. For each lease, determine the current billing period based on rent_due_day
 * 3. Check if an invoice already exists for that period
 * 4. If not, create a draft invoice
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createWorkerPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter }) as unknown as import("@/generated/prisma/client").PrismaClient;
}

export async function generateInvoices(): Promise<{ created: number; errors: string[] }> {
  const prisma = createWorkerPrisma();
  let created = 0;
  const errors: string[] = [];

  try {
    const leases = await prisma.lease.findMany({
      where: { status: { in: ["active", "signed"] } },
      select: {
        id: true,
        organizationId: true,
        monthlyRentMinor: true,
        rentDueDay: true,
        startDate: true,
        endDate: true,
      },
    });

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    for (const lease of leases) {
      try {
        const { periodStart, periodEnd, dueDate } = calculateBillingPeriod(
          lease.rentDueDay,
          currentYear,
          currentMonth
        );

        // Skip if period is outside lease dates
        if (periodStart < lease.startDate || periodEnd > lease.endDate) {
          continue;
        }

        // Check if invoice already exists for this period
        const existing = await prisma.invoice.findFirst({
          where: {
            leaseId: lease.id,
            periodStart,
            periodEnd,
          },
        });

        if (existing) continue;

        await prisma.invoice.create({
          data: {
            organizationId: lease.organizationId,
            leaseId: lease.id,
            periodStart,
            periodEnd,
            amountDueMinor: lease.monthlyRentMinor,
            amountPaidMinor: 0,
            dueDate,
            status: "draft",
          },
        });

        created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Lease ${lease.id}: ${msg}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  return { created, errors };
}

function calculateBillingPeriod(
  rentDueDay: number,
  year: number,
  month: number
): { periodStart: Date; periodEnd: Date; dueDate: Date } {
  // Period: from rent_due_day of previous month to rent_due_day of current month
  // Due date: rent_due_day of current month
  const dueDate = new Date(Date.UTC(year, month, rentDueDay));

  // Period start: rent_due_day of previous month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const periodStart = new Date(Date.UTC(prevYear, prevMonth, rentDueDay));

  // Period end: day before due date
  const periodEnd = new Date(dueDate);
  periodEnd.setUTCDate(periodEnd.getUTCDate() - 1);

  return { periodStart, periodEnd, dueDate };
}
