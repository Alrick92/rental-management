-- Row-Level Security policies for all tenant-scoped tables
-- The application sets app.current_organization_id per transaction via withOrgContext()
--
-- Architecture:
-- - A dedicated `rental_app` role is used by the application at runtime
-- - This role respects RLS policies (it does NOT own the tables)
-- - The table owner role (used by Prisma Migrate) bypasses RLS naturally
-- - withOrgContext() sets ROLE + config to enforce tenant isolation on writes/reads

-- Create the application role (non-owner, respects RLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rental_app') THEN
    CREATE ROLE rental_app NOLOGIN;
  END IF;
END
$$;

-- Grant usage and access to the app role
GRANT USAGE ON SCHEMA public TO rental_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rental_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rental_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rental_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO rental_app;

-- Allow the connection role to SET ROLE to rental_app
GRANT rental_app TO current_user;

-- ─── Units ───────────────────────────────────────────────────────────────────

ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_tenant_isolation" ON "units"
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ─── Contacts ────────────────────────────────────────────────────────────────

ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_tenant_isolation" ON "contacts"
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ─── Leases ──────────────────────────────────────────────────────────────────

ALTER TABLE "leases" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leases_tenant_isolation" ON "leases"
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ─── Lease Tenants (join table — isolate via lease's org) ────────────────────

ALTER TABLE "lease_tenants" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lease_tenants_tenant_isolation" ON "lease_tenants"
  USING (EXISTS (
    SELECT 1 FROM leases WHERE leases.id = lease_tenants.lease_id
    AND leases.organization_id = current_setting('app.current_organization_id', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM leases WHERE leases.id = lease_tenants.lease_id
    AND leases.organization_id = current_setting('app.current_organization_id', true)::uuid
  ));

-- ─── Bookings ────────────────────────────────────────────────────────────────

ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_tenant_isolation" ON "bookings"
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ─── Booking Guests (join table — isolate via booking's org) ─────────────────

ALTER TABLE "booking_guests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_guests_tenant_isolation" ON "booking_guests"
  USING (EXISTS (
    SELECT 1 FROM bookings WHERE bookings.id = booking_guests.booking_id
    AND bookings.organization_id = current_setting('app.current_organization_id', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM bookings WHERE bookings.id = booking_guests.booking_id
    AND bookings.organization_id = current_setting('app.current_organization_id', true)::uuid
  ));

-- ─── Payments ────────────────────────────────────────────────────────────────

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_tenant_isolation" ON "payments"
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ─── Invoices ────────────────────────────────────────────────────────────────

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_tenant_isolation" ON "invoices"
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ─── Maintenance Tickets ─────────────────────────────────────────────────────

ALTER TABLE "maintenance_tickets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_tickets_tenant_isolation" ON "maintenance_tickets"
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ─── Maintenance Comments ────────────────────────────────────────────────────

ALTER TABLE "maintenance_comments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_comments_tenant_isolation" ON "maintenance_comments"
  USING (EXISTS (
    SELECT 1 FROM maintenance_tickets WHERE maintenance_tickets.id = maintenance_comments.ticket_id
    AND maintenance_tickets.organization_id = current_setting('app.current_organization_id', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM maintenance_tickets WHERE maintenance_tickets.id = maintenance_comments.ticket_id
    AND maintenance_tickets.organization_id = current_setting('app.current_organization_id', true)::uuid
  ));

-- ─── Cleaning Schedules ──────────────────────────────────────────────────────

ALTER TABLE "cleaning_schedules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cleaning_schedules_tenant_isolation" ON "cleaning_schedules"
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ─── Documents ───────────────────────────────────────────────────────────────

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_tenant_isolation" ON "documents"
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ─── User Invitations ────────────────────────────────────────────────────────

ALTER TABLE "user_invitations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_invitations_tenant_isolation" ON "user_invitations"
  USING (organization_id = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id', true)::uuid);

-- ─── Audit Log ───────────────────────────────────────────────────────────────

ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_tenant_isolation" ON "audit_log"
  USING (
    organization_id IS NULL
    OR organization_id = current_setting('app.current_organization_id', true)::uuid
  )
  WITH CHECK (
    organization_id IS NULL
    OR organization_id = current_setting('app.current_organization_id', true)::uuid
  );

-- ─── Rate Plans ──────────────────────────────────────────────────────────────

ALTER TABLE "rate_plans" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_plans_tenant_isolation" ON "rate_plans"
  USING (EXISTS (
    SELECT 1 FROM units WHERE units.id = rate_plans.unit_id
    AND units.organization_id = current_setting('app.current_organization_id', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM units WHERE units.id = rate_plans.unit_id
    AND units.organization_id = current_setting('app.current_organization_id', true)::uuid
  ));

-- ─── Rate Plan Periods ───────────────────────────────────────────────────────

ALTER TABLE "rate_plan_periods" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_plan_periods_tenant_isolation" ON "rate_plan_periods"
  USING (EXISTS (
    SELECT 1 FROM rate_plans
    JOIN units ON units.id = rate_plans.unit_id
    WHERE rate_plans.id = rate_plan_periods.rate_plan_id
    AND units.organization_id = current_setting('app.current_organization_id', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rate_plans
    JOIN units ON units.id = rate_plans.unit_id
    WHERE rate_plans.id = rate_plan_periods.rate_plan_id
    AND units.organization_id = current_setting('app.current_organization_id', true)::uuid
  ));

-- ─── Unit Blocked Dates ──────────────────────────────────────────────────────

ALTER TABLE "unit_blocked_dates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_blocked_dates_tenant_isolation" ON "unit_blocked_dates"
  USING (EXISTS (
    SELECT 1 FROM units WHERE units.id = unit_blocked_dates.unit_id
    AND units.organization_id = current_setting('app.current_organization_id', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM units WHERE units.id = unit_blocked_dates.unit_id
    AND units.organization_id = current_setting('app.current_organization_id', true)::uuid
  ));

-- ─── Unit Availability Rules ─────────────────────────────────────────────────

ALTER TABLE "unit_availability_rules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unit_availability_rules_tenant_isolation" ON "unit_availability_rules"
  USING (EXISTS (
    SELECT 1 FROM units WHERE units.id = unit_availability_rules.unit_id
    AND units.organization_id = current_setting('app.current_organization_id', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM units WHERE units.id = unit_availability_rules.unit_id
    AND units.organization_id = current_setting('app.current_organization_id', true)::uuid
  ));

-- ─── Note on sessions/users ──────────────────────────────────────────────────
-- Sessions and users have nullable organization_id (super_admin has null).
-- RLS is NOT enabled on these tables because:
-- 1. Session validation happens before org context is set (chicken-and-egg)
-- 2. The auth layer needs to read sessions without org context to authenticate
-- 3. Super-admin sessions have null org_id
-- These are protected at the application layer via requireAuth()
