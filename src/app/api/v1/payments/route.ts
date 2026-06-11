import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createPaymentSchema, paginationSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid pagination params", reqId, {
      issues: parsed.error.issues,
    });
  }
  const { cursor, limit } = parsed.data;
  const leaseFilter = url.searchParams.get("lease_id");
  const bookingFilter = url.searchParams.get("booking_id");

  const payments = await withOrgContext(session.organizationId, (tx) =>
    tx.payment.findMany({
      where: {
        organizationId: session.organizationId,
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(leaseFilter ? { leaseId: leaseFilter } : {}),
        ...(bookingFilter ? { bookingId: bookingFilter } : {}),
      },
      orderBy: { receivedAt: "desc" },
      take: limit + 1,
      include: {
        contact: { select: { id: true, name: true } },
        lease: { select: { id: true, status: true } },
        booking: { select: { id: true, status: true } },
        recordedBy: { select: { id: true, name: true } },
      },
    })
  );

  const hasMore = payments.length > limit;
  if (hasMore) payments.pop();

  return jsonResponse(
    {
      data: payments,
      next_cursor: hasMore ? payments[payments.length - 1].id : null,
    },
    reqId
  );
}

export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  // Validate lease or booking belongs to org
  if (data.lease_id) {
    const lease = await prisma.lease.findFirst({
      where: { id: data.lease_id, organizationId: session.organizationId },
    });
    if (!lease) {
      return errorResponse(404, "lease_not_found", "Lease not found", reqId);
    }
  }
  if (data.booking_id) {
    const booking = await prisma.booking.findFirst({
      where: { id: data.booking_id, organizationId: session.organizationId },
    });
    if (!booking) {
      return errorResponse(404, "booking_not_found", "Booking not found", reqId);
    }
  }
  if (data.contact_id) {
    const contact = await prisma.contact.findFirst({
      where: { id: data.contact_id, organizationId: session.organizationId, deletedAt: null },
    });
    if (!contact) {
      return errorResponse(404, "contact_not_found", "Contact not found", reqId);
    }
  }

  // Idempotency key
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) {
    const existing = await prisma.payment.findFirst({
      where: {
        organizationId: session.organizationId,
        idempotencyKey,
      },
    });
    if (existing) {
      return jsonResponse(existing, reqId, 200);
    }
  }

  const payment = await withOrgContext(session.organizationId, (tx) =>
    tx.payment.create({
      data: {
        organizationId: session.organizationId,
        leaseId: data.lease_id ?? null,
        bookingId: data.booking_id ?? null,
        contactId: data.contact_id ?? null,
        amountMinor: data.amount_minor,
        currency: data.currency,
        method: data.method,
        reference: data.reference ?? null,
        receivedAt: new Date(data.received_at),
        recordedByUserId: session.userId,
        idempotencyKey: idempotencyKey ?? null,
        notes: data.notes ?? null,
      },
      include: {
        contact: { select: { id: true, name: true } },
        recordedBy: { select: { id: true, name: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "payments.create",
    entityTable: "payments",
    entityId: payment.id,
    after: payment,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(payment, reqId, 201);
}
