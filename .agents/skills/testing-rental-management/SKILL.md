---
name: testing-rental-management
description: Test the Rental Management app end-to-end. Use when verifying financial flows, portal UIs, or API changes.
---

# Testing the Rental Management App

## Environment Setup

1. **Docker (PostgreSQL):** Ensure the DB is running: `docker compose up -d`
2. **Prisma client:** After any schema migration, run `npx prisma generate` — the dev server will throw 500s on new fields if this is missed
3. **Dev server:** `npm run dev` starts on http://localhost:3000
4. **Seed data:** `npx prisma db seed` creates all 8 roles. Run `export $(grep -v '^#' .env | xargs)` before any `npx tsx` scripts to load env vars
5. **Lint/typecheck:** `npm run lint` and `npm run typecheck`

## Test Accounts

All passwords: `password123!secure`

| Role | Email | Portal |
|------|-------|--------|
| org_admin | manager@demo-properties.com | /dashboard |
| property_manager | pm@demo-properties.com | /dashboard |
| landlord | landlord@demo-properties.com | /landlord |
| tenant | tenant@demo-properties.com | /tenant |
| maintenance_staff | maint@demo-properties.com | /maintenance |
| agent | agent@demo-properties.com | /dashboard |
| super_admin | admin@rental.local | /dashboard |
| vendor | vendor@demo-properties.com | /dashboard |

## Seed Data Quirks

- Seed UUIDs use all-zero variant bytes (e.g., `00000000-0000-0000-0000-000000000010`), which pass Prisma but **fail Zod's strict UUID regex** in API request bodies. If you need to reference seed IDs in API calls, create new records via the API or use direct Prisma scripts instead.
- The seed script does **not** create leases. To test financial features (invoices, payments, FIFO allocation), you must create a lease first — either via `/dashboard/leases` UI or a Prisma script.
- When running `.ts` scripts against the DB, use `export $(grep -v '^#' .env | xargs)` then `npx tsx <script>`, NOT `source .env` (the `.env` format may not be bash-compatible).

## User IDs (for messaging participant fields)

| Role | User ID |
|------|---------|
| Manager (org_admin) | `4dc43162-33e1-44af-9ab8-54496f7d5517` |
| Tenant | `131ccbd3-38b1-45b7-a444-4b2cb6b037d4` |
| Landlord | `5298f10f-adb7-478e-ac96-5d888460f29c` |

These are needed when creating message threads — the "Participant User IDs" field requires actual UUIDs.

## Key Test Flows

### Financial E2E (Phase 2)
1. **Create lease** (if none exists) — need active lease with tenant
2. **Generate invoices** — `/dashboard/invoices` → "Generate Invoices" button
3. **Tenant payment** — login as tenant → `/tenant/payments` → "Submit Payment"
4. **Approve payment** — login as manager → `/dashboard/payments` → "Approve"
5. **Verify FIFO** — `/dashboard/invoices` should show invoice status → "paid"
6. **Reports** — `/dashboard/reports` shows revenue/expenses/net/occupancy
7. **Landlord financials** — `/landlord/financials` shows per-property breakdown

### Enhanced Features E2E (Phase 3)
1. **Analytics Dashboard** — login as manager → `/dashboard` shows KPI cards (occupancy, revenue, net income, open tickets), upcoming check-ins/outs, pending payments, recent announcements
2. **Calendar** — `/dashboard/calendar` shows month-view grid with color-coded bookings + lease events. Use Prev/Next to navigate months.
3. **Announcements** — `/dashboard/announcements` → "New Announcement" → fill title/body/scope → publish. Verify tenant sees it on `/tenant` dashboard under "Recent Announcements"
4. **Messaging** — `/dashboard/messages` → "New Conversation" → enter subject, participant UUID, message body → "Start Conversation". Open thread to verify messages. Then login as tenant → `/tenant/messages` to verify cross-portal visibility + unread dot
5. **Tenant Dashboard** — `/tenant` shows Current Balance card (from `/api/v1/tenant/balance`), quick nav cards, and recent announcements
6. **Landlord Messages** — `/landlord/messages` loads without errors, shows "No messages yet" if not a participant in any thread (proves ThreadParticipant scoping)

### Compliance & Hardening E2E (Phase 4)
1. **Audit Log (org_admin)** — login as manager → `/dashboard/audit-log` shows org-scoped entries with action/entity/user/timestamp columns. Filter by action (e.g. "create") works. Generate audit events first by creating a contact if log is empty.
2. **Audit Log (super_admin)** — login as admin@rental.local at `/admin/login` → `/admin/audit-log` shows cross-org view with "Org" column. Dark theme (bg-gray-900).
3. **GDPR Export** — `/dashboard/gdpr` → select contact → "Export Data" → green "Export generated successfully" message, JSON preview with contact PII, "Download JSON" button, GDPR Request History entry with type "export" / status "completed"
4. **GDPR Erase** — select contact → "Erase Data" → confirm dialog → name becomes "[Erased Contact xxxxxxxx]", email nullified. Verify on `/dashboard/contacts`. GDPR Request History shows "erase" / "completed"
5. **Global Search** — `/dashboard/search` → type "Downtown" → results with entity type badges (property, unit). Type filter dropdown narrows results.
6. **Bulk Contact Import** — `/dashboard/contacts` → "Bulk Import" → upload CSV (name,email,phone header) → "X created, Y skipped". Re-upload same CSV → "0 created, X skipped" (case-insensitive duplicate detection)
7. **Organizations** — `/admin/organizations` → list with name/slug/status/counts → create new org with name + slug
8. **System Settings** — `/admin/settings` → 8 default settings displayed → click Edit on any → change value → Save → green "Saved" banner + value persists
9. **Mobile Maintenance** — login as maint@ → `/maintenance` → resize to 375px → card layout (not table), bottom nav bar with icons, filter pills (All/Open/In Progress/Resolved), tap card to expand → description + "high priority" badge + full-width "Mark as Resolved" button

### Payment Approval
- Payments submitted by tenants start as "pending" (yellow badge)
- Manager clicks "Approve" → status becomes "approved" (green badge)
- FIFO allocation runs on approval: allocates to oldest unpaid invoices first
- After allocation: invoice Paid amount increases, Balance decreases, status may change to "paid"

### Role Portal Routing
- org_admin/property_manager/agent → `/dashboard`
- landlord → `/landlord`
- tenant → `/tenant`
- maintenance_staff → `/maintenance`

## Common Issues

- **500 on new features after schema migration:** Run `npx prisma generate` after any schema changes — the Prisma client won't know about new models/relations (e.g., ThreadParticipant). Restart the dev server afterward.
- **API response field naming:** The API uses snake_case (`user_id`, `balance_due`), but some frontend code might assume camelCase (`userId`, `balance`). If you see `$NaN` or `undefined` in the UI, check the API response structure via curl first.
- **`/api/v1/auth/me` response shape:** Returns flat `{ user_id, organization_id, role, display_name, email, portal_path }` — NOT nested `{ user: { id } }`.
- **Alert dialogs:** The app uses `window.alert()` for success/error messages. When testing via browser automation, these may be auto-dismissed. Override `window.alert` via console to capture messages if needed.
- **Empty responses from API:** Check server logs for Prisma validation errors — common when Prisma client is outdated after schema changes.
- **Zod v4 UUID validation:** `z.string().uuid()` in Zod v4 enforces strict RFC 4122 — version digit (position 15) must be 1-8. Seed data UUIDs with version 0 (e.g. `00000000-0000-0000-0000-000000000011`) will fail. Use a permissive regex (`/^[0-9a-fA-F]{8}-...-[0-9a-fA-F]{12}$/`) instead if seed data IDs need to pass validation.
- **AuditLog entityId must be UUID:** The `entity_id` column is `@db.Uuid`. Do not pass non-UUID strings (like setting keys) as `entityId` in `writeAuditLog()`. Use a related UUID (e.g. `setting.id` or `auth.userId`) instead, or wrap in try-catch.
- **RLS requires `rental_app` role:** Row-Level Security policies reference a `rental_app` PostgreSQL role. If this role doesn't exist, org-scoped APIs (audit logs, bulk contacts, etc.) return empty results or 500. Create it with: `docker exec <db-container> psql -U rental -d rental_management -c "CREATE ROLE rental_app LOGIN PASSWORD 'rental_app_password'; GRANT ALL ON ALL TABLES IN SCHEMA public TO rental_app;"` then run the RLS migration SQL.
- **Super admin login:** Use `/admin/login` (not `/login`) for admin@rental.local. The admin session uses a separate cookie (`sid_admin`).
- **Mobile viewport testing:** Use `set_mobile` with width=375, height=812. The maintenance portal switches from table to card layout below 640px. Bottom nav bar appears at mobile widths. Cards are clickable buttons that expand to show description + "Mark as Resolved".

## Devin Secrets Needed

No external secrets required — all auth is local with seeded credentials.
