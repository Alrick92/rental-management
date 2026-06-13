import type { PrismaClient as PrismaClientType } from "@/generated/prisma/client";

/**
 * FIFO payment allocation: allocates an approved payment to the oldest unpaid invoices
 * for the same lease. Updates invoice.amountPaidMinor and status accordingly.
 */
export async function allocatePaymentFIFO(
  tx: PrismaClientType,
  paymentId: string,
  leaseId: string,
  amountMinor: number,
  organizationId: string
): Promise<{ allocated: number; allocations: Array<{ invoiceId: string; amount: number }> }> {
  const unpaidInvoices = await tx.invoice.findMany({
    where: {
      organizationId,
      leaseId,
      status: { in: ["sent", "partially_paid", "overdue"] },
    },
    orderBy: { dueDate: "asc" },
  });

  let remaining = amountMinor;
  const allocations: Array<{ invoiceId: string; amount: number }> = [];

  for (const invoice of unpaidInvoices) {
    if (remaining <= 0) break;

    const owed = invoice.amountDueMinor - invoice.amountPaidMinor;
    if (owed <= 0) continue;

    const allocAmount = Math.min(remaining, owed);
    remaining -= allocAmount;

    await tx.paymentAllocation.create({
      data: {
        paymentId,
        invoiceId: invoice.id,
        amountMinor: allocAmount,
      },
    });

    const newPaid = invoice.amountPaidMinor + allocAmount;
    const newStatus = newPaid >= invoice.amountDueMinor ? "paid" : "partially_paid";

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaidMinor: newPaid,
        status: newStatus,
      },
    });

    allocations.push({ invoiceId: invoice.id, amount: allocAmount });
  }

  return { allocated: amountMinor - remaining, allocations };
}
