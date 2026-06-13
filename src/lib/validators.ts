import { z } from "zod/v4";

// ─── Auth ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const adminLoginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

// ─── Pagination ──────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ─── Units ───────────────────────────────────────────────────────────────────

export const createUnitSchema = z.object({
  name: z.string().min(1).max(255),
  unit_kind: z.enum(["apartment", "house", "vacation_property", "commercial_building", "commercial_unit", "room"]),
  parent_unit_id: z.string().uuid().optional(),
  is_rentable: z.boolean().default(true),
  rental_type: z.enum(["long_term", "short_term", "both"]).optional(),
  address_line1: z.string().max(500).optional(),
  city: z.string().max(255).optional(),
  region: z.string().max(255).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(2).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  max_occupancy: z.number().int().min(1).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateUnitSchema = createUnitSchema.partial();

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

// ─── Contacts ────────────────────────────────────────────────────────────────

export const createContactSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.email().optional(),
  phone: z.string().max(50).optional(),
  id_document_type: z.string().max(50).optional(),
  id_document_number: z.string().max(100).optional(),
  address: z.string().max(1000).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

// ─── Leases ──────────────────────────────────────────────────────────────────

export const createLeaseSchema = z.object({
  unit_id: z.string().uuid(),
  start_date: z.iso.date(),
  end_date: z.iso.date(),
  monthly_rent_minor: z.number().int().min(0),
  currency: z.string().length(3),
  security_deposit_minor: z.number().int().min(0),
  rent_due_day: z.number().int().min(1).max(28),
  tenant_ids: z.array(z.string().uuid()).min(1),
});

export const updateLeaseSchema = z.object({
  start_date: z.iso.date().optional(),
  end_date: z.iso.date().optional(),
  monthly_rent_minor: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  security_deposit_minor: z.number().int().min(0).optional(),
  rent_due_day: z.number().int().min(1).max(28).optional(),
});

export const terminateLeaseSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;

// ─── Bookings ────────────────────────────────────────────────────────────────

export const createBookingSchema = z.object({
  unit_id: z.string().uuid(),
  check_in: z.iso.date(),
  check_out: z.iso.date(),
  nightly_rate_minor: z.number().int().min(0),
  total_amount_minor: z.number().int().min(0),
  currency: z.string().length(3),
  primary_contact_id: z.string().uuid(),
  channel: z.enum(["direct", "airbnb", "booking_com", "other"]).default("direct"),
  notes: z.string().max(5000).optional(),
});

export const updateBookingSchema = z.object({
  check_in: z.iso.date().optional(),
  check_out: z.iso.date().optional(),
  nightly_rate_minor: z.number().int().min(0).optional(),
  total_amount_minor: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  channel: z.enum(["direct", "airbnb", "booking_com", "other"]).optional(),
  notes: z.string().max(5000).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

// ─── Payments ────────────────────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  lease_id: z.string().uuid().optional(),
  booking_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  amount_minor: z.number().int(),
  currency: z.string().length(3),
  method: z.enum(["cash", "bank_transfer", "check", "deposit", "refund", "void_payment", "other"]),
  reference: z.string().max(255).optional(),
  received_at: z.iso.datetime(),
  notes: z.string().max(5000).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// ─── Properties ──────────────────────────────────────────────────────────────

export const createPropertySchema = z.object({
  name: z.string().min(1).max(255),
  address_line1: z.string().max(500).optional(),
  city: z.string().max(255).optional(),
  region: z.string().max(255).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(2).optional(),
  primary_manager_user_id: z.string().uuid().optional(),
  backup_manager_user_id: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
});

export const updatePropertySchema = createPropertySchema.partial();

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

// ─── Expenses ────────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  property_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
  category: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  amount_minor: z.number().int().min(0),
  currency: z.string().length(3),
  expense_date: z.iso.date(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ─── Maintenance Tickets ─────────────────────────────────────────────────────

export const createTicketSchema = z.object({
  unit_id: z.string().uuid(),
  reported_by_contact_id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export const updateTicketSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

export const assignTicketSchema = z.object({
  assigned_to_user_id: z.string().uuid(),
});

export const logMaintenanceCostSchema = z.object({
  kind: z.enum(["labor", "material"]),
  description: z.string().max(500).optional(),
  hours: z.number().min(0).optional(),
  amount_minor: z.number().int().min(0),
  currency: z.string().length(3),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type LogMaintenanceCostInput = z.infer<typeof logMaintenanceCostSchema>;

// ─── Invoice Generation ──────────────────────────────────────────────────────

export const generateInvoicesSchema = z.object({
  as_of_date: z.iso.date().optional(),
});

export type GenerateInvoicesInput = z.infer<typeof generateInvoicesSchema>;

// ─── Disbursements ───────────────────────────────────────────────────────────

export const generateDisbursementSchema = z.object({
  property_id: z.string().uuid(),
  period_start: z.iso.date(),
  period_end: z.iso.date(),
});

export type GenerateDisbursementInput = z.infer<typeof generateDisbursementSchema>;

// ─── Tenant Payment Submission ───────────────────────────────────────────────

export const tenantPaymentSchema = z.object({
  amount_minor: z.number().int().min(1),
  currency: z.string().length(3),
  method: z.enum(["cash", "bank_transfer", "check", "deposit", "other"]),
  reference: z.string().max(255).optional(),
  notes: z.string().max(5000).optional(),
});

export type TenantPaymentInput = z.infer<typeof tenantPaymentSchema>;

// ─── Messaging ───────────────────────────────────────────────────────────────

export const createThreadSchema = z.object({
  subject: z.string().min(1).max(255),
  participant_ids: z.array(z.string().uuid()).min(1),
  body: z.string().min(1).max(10000),
  property_id: z.string().uuid().optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(10000),
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// ─── Announcements ───────────────────────────────────────────────────────────

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1).max(10000),
  scope: z.enum(["org", "property", "contact"]),
  property_id: z.string().uuid().optional(),
  publish: z.boolean().default(false),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  body: z.string().min(1).max(10000).optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

// ─── User Management ─────────────────────────────────────────────────────────

export const inviteUserSchema = z.object({
  email: z.email("Invalid email address"),
  name: z.string().min(1).max(255),
  role: z.enum([
    "org_admin",
    "property_manager",
    "agent",
    "landlord",
    "tenant",
    "maintenance_staff",
    "vendor",
  ]),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

// ─── Org Settings ────────────────────────────────────────────────────────────

export const updateOrgSettingsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  default_currency: z.string().length(3).optional(),
  timezone: z.string().min(1).max(100).optional(),
  management_fee_percent: z.number().int().min(0).max(100).optional(),
  invoice_lead_days: z.number().int().min(0).max(90).optional(),
  grace_period_days: z.number().int().min(0).max(90).optional(),
});

export type UpdateOrgSettingsInput = z.infer<typeof updateOrgSettingsSchema>;

// ─── Documents ───────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const documentQuerySchema = z.object({
  owner_table: z.enum(["properties", "leases", "contacts", "maintenance_tickets"]),
  owner_id: z.string().regex(UUID_RE, "Invalid UUID"),
});
