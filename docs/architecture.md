# Rental Management SaaS — Architecture Document

**Version:** 1.0 (v1 scope)
**Status:** Approved for build
**Date:** 2026-06-11
**Companion to:** [`product-requirements.md`](./product-requirements.md)

---

## 0. TL;DR

A multi-tenant rental management SaaS for property managers handling both **long-term leases** and **short-term bookings**. Single Next.js application, single PostgreSQL database, single VM, one `docker compose up` to run it all. Server-side sessions, row-level multi-tenancy at the database, REST API, jobs in pg-boss, local file storage with an S3-compatible escape hatch, SMTP configurable from the admin panel. Optimized for a small AI-assisted team to build, ship, and maintain — not for theoretical scale. Comfortably handles 250 concurrent users and the realistic 10x growth beyond.

---

## 1. Requirements & Constraints (Phase 1)

| | |
|---|---|
| **Product** | Multi-tenant rental management SaaS. Long-term + short-term rentals. |
| **Primary user** | Property managers / agents operating rental businesses. |
| **Scale (v1)** | ~250 concurrent users at peak. |
| **Deployment** | Single VM (Linux), Docker Compose stack. Cloud-hosted, you manage the box. |
| **Stack** | Next.js (App Router, TypeScript), PostgreSQL 16. |
| **Payments** | Manual entry by an agent. No payment processor. No PCI scope. |
| **Tenancy** | Multi-tenant SaaS. Single URL (`app.example.com`); tenant picked at login. |
| **Team** | Small, AI-assisted ("vibecoded"). Minimize operational surface area. |
| **SLA** | "Minimum downtime" — pragmatic, not five-nines. Single-region is fine. |
| **Compliance** | GDPR-friendly by default; no formal certification in v1. |
| **External deps in v1** | SMTP server (paid, external, configured from admin panel) + optional Sentry for error tracking. |
| **Data residency** | VM region is the data region. (Pick EU if GDPR matters.) |

**Out of scope for v1:** payments processor, channel manager (Airbnb/Booking.com sync), mobile app, per-org custom domains, 2FA (v1.1), SOC 2 / ISO certification, multi-region.

---

## 2. System Design (Phase 2)

### Component diagram

```
┌───────────────────── Single VM, Docker Compose ─────────────────────┐
│                                                                      │
│  ┌─────────────────── Docker network ────────────────────────────┐  │
│  │                                                                │  │
│  │  ┌──────────────┐                                              │  │
│  │  │   Caddy      │ :80 / :443                                   │  │
│  │  │   (auto-TLS) │ ◀── Let's Encrypt                           │  │
│  │  └──────┬───────┘                                              │  │
│  │         │ reverse proxy + security headers                     │  │
│  │         ▼                                                      │  │
│  │  ┌──────────────┐         ┌────────────────┐                   │  │
│  │  │  Next.js app │ ──────▶ │ pg-boss worker │                   │  │
│  │  │  (web + API) │  enq/   │  (cron jobs:   │                   │  │
│  │  │  container 1 │  deq    │   reminders,   │                   │  │
│  │  └──────┬───────┘         │   rollups,     │                   │  │
│  │         │                 │   backups)     │                   │  │
│  │         │                 └────────┬───────┘                   │  │
│  │         │                          │                           │  │
│  │         │     ┌────────────────────▼─────────┐                 │  │
│  │         └────▶│       PostgreSQL 16          │                 │  │
│  │               │  (data + pg-boss queues +    │                 │  │
│  │               │   RLS + exclusion consts)   │                 │  │
│  │               └────────────┬────────────────┘                 │  │
│  │                            │                                  │  │
│  │                  ┌─────────▼──────────┐                       │  │
│  │                  │ Persistent volume  │                       │  │
│  │                  │ ./storage/         │  ◀── photos, PDFs     │  │
│  │                  │ (StorageProvider)  │                       │  │
│  │                  └────────────────────┘                       │  │
│  │                                                                │  │
│  │  ┌─────────────────────────────────────────┐                  │  │
│  │  │ Backup container (nightly cron)         │                  │  │
│  │  │  pg_dump + tar → encrypted → offsite    │                  │  │
│  │  └─────────────────────────────────────────┘                  │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Uptime monitor (UptimeRobot free tier) ──▶ https://app.example.com/api/health
│  SMTP (paid external service)         ◀───  app (config from admin panel)
│  Offsite backup bucket (Backblaze B2) ◀───  backup container
│  Sentry (optional)                    ◀───  app error reports
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Purpose | Container |
|---|---|---|
| **Caddy** | TLS termination, HTTP→HTTPS, security headers, reverse proxy | `caddy:2` |
| **Next.js app** | Web UI (React server components) + REST API at `/api/v1/` | Custom image, `web` entrypoint |
| **pg-boss worker** | Background jobs (rent reminders, lease expiration notices, cleaning schedule generation, nightly invoice rollup, email sending, offsite backup) | Same image, `worker` entrypoint |
| **PostgreSQL 16** | Data + pg-boss queues + RLS | `postgres:16-alpine` |
| **Backup container** | Nightly cron: `pg_dump` + tar of `./storage/`, encrypts, uploads to offsite bucket | Custom image (small script) |

**Two processes, one codebase, one database.** No microservices, no Redis, no Kubernetes, no separate API server.

### Service boundaries

**One application, deployed as two processes** (web + worker) sharing one database. The split exists only so the worker can't starve the web server on long jobs — same image, different `CMD`. If a single component needs to be extracted later (e.g., a heavy reporting job), it can be split out **without changing the rest.**

### Communication patterns

- **Sync (request → response):** all user actions in the UI. API route → service function → DB. Always sync.
- **Async (pg-boss queue):** anything time-based, slow, or with side effects beyond the user's immediate request:
  - Rent reminder emails
  - Lease expiration notices
  - Cleaning schedule generation (post-checkout + daily forward-look)
  - Nightly invoice rollup (long-term leases)
  - Email sending in general (decouples user-facing request from SMTP latency/failures)
  - Offsite backup

**Why send email through the queue:** the user's "Record Payment" returns 200 in 100ms; SMTP happens async, retries automatically on failure.

### Third-party integrations in v1

| Integration | Required? | How configured |
|---|---|---|
| **SMTP server** | Yes | Admin panel → system settings (host/port/user/pass/TLS/from-address) |
| **Uptime monitor** | Yes (operationally) | UptimeRobot free tier, hits `/api/health` every 60s |
| **Offsite backup target** | Yes | Admin panel → system settings (B2 / S3 / local). Default: Backblaze B2. |
| **Sentry (or GlitchTip)** | Recommended | Env var in `.env`; the app checks for it and degrades gracefully if absent |

---

## 3. Data Layer (Phase 3)

### Tenancy and isolation

- **Every tenant-owned table** has an `organization_id` column (UUID, FK to `organizations.id`).
- **Postgres Row-Level Security (RLS)** is enabled on every tenant-owned table.
- **Per-request pattern:** the app calls `SELECT set_config('app.current_organization_id', $orgId, true)` at the start of every transaction. RLS policies filter all reads and writes by this setting.
- **The super-admin role** uses a separate Postgres role (bypasses RLS) and a separate `admin_sessions` table; the only way to log in is via a dedicated super-admin login page.

This is the single biggest defense against the "one bug leaks every tenant" failure. The app still writes `WHERE organization_id = ?` in queries (for planner/index use), but RLS is the safety net.

### Entity overview

```
organizations (the SaaS customers)
   │
   ├──▶ users  (login accounts; role: super_admin | org_admin | agent)
   │
   ├──▶ units  (self-referential: parent_unit_id)
   │      ├──▶ rate_plans  (short-term seasonal pricing)
   │      │      └──▶ rate_plan_periods
   │      ├──▶ unit_blocked_dates       (admin-defined unavailabilities)
   │      ├──▶ unit_availability_rules  (e.g., "no short-term on weekends")
   │      ├──▶ maintenance_tickets
   │      ├──▶ cleaning_schedules
   │      └──▶ documents  (polymorphic file metadata)
   │
   ├──▶ contacts  (renters/guests; shared between leases and bookings)
   │
   ├──▶ leases  (long-term; immutable once signed)
   │      ├──▶ lease_tenants  (join; role: primary | co_tenant | guarantor)
   │      ├──▶ payments
   │      └──▶ invoices  (generated nightly)
   │
   ├──▶ bookings  (short-term; seasonal pricing snapshotted at creation)
   │      ├──▶ booking_guests
   │      └──▶ payments
   │
   ├──▶ audit_log  (append-only; who-did-what)
   │
   └──▶ system_settings  (global, super-admin only: SMTP, backups, app config)
```

### The core tables (column-level highlights)

**`organizations`**
- `id`, `name`, `slug`, `status` (`active` | `suspended`), `created_at`.
- No per-org custom domains in v1.

**`users`**
- `id`, `organization_id` (nullable for super_admin), `email` (globally unique), `name`, `role`, `status`, `last_login_at`, `password_hash` (Argon2id), `password_changed_at`, `password_must_change` (bool, true after admin reset).
- `email` unique across all orgs.

**`units`** (self-referential)
- `id`, `organization_id`, `parent_unit_id` (nullable, FK to `units.id`), `name`, `unit_kind` (`apartment` | `house` | `vacation_property` | `commercial_building` | `commercial_unit` | `room`), `is_rentable`, `rental_type` (`long_term` | `short_term` | `both`), `address_line1`, `city`, `region`, `postal_code`, `country`, `bedrooms`, `bathrooms`, `max_occupancy` (short-term), `notes`, `status` (`active` | `archived`).
- **Indexes:** `(organization_id, parent_unit_id)`, `(organization_id, rental_type)`.
- **Constraint:** `parent_unit_id != id`.
- **Address inheritance:** the form pre-fills the parent's address for sub-units.

**`rate_plans`** (short-term)
- `id`, `unit_id`, `name`, `priority` (int, higher wins), `is_default`.

**`rate_plan_periods`**
- `id`, `rate_plan_id`, `start_date`, `end_date`, `nightly_rate` (integer minor units), `currency` (ISO 4217), `min_nights`, `max_nights`.
- **Index:** `(rate_plan_id, start_date, end_date)`.

**`unit_blocked_dates`**
- `id`, `unit_id`, `start_date`, `end_date`, `reason` (`owner_use` | `maintenance` | `policy` | `other`), `notes`, `created_by_user_id`.
- **Index:** `(unit_id, start_date, end_date)`.

**`unit_availability_rules`**
- `id`, `unit_id`, `day_of_week` (0–6), `applies_to` (`long_term` | `short_term` | `both`).
- Handles "no short-term on weekends" etc.

**`contacts`**
- `id`, `organization_id`, `name`, `email`, `phone`, `id_document_type`, `id_document_number` (**encrypted at rest via pgcrypto**), `address`, `notes`, `created_at`.
- **Index:** `(organization_id, email)`.

**`leases`** (long-term, immutable once signed)
- `id`, `organization_id`, `unit_id`, `start_date`, `end_date`, `monthly_rent_minor` (integer), `currency`, `security_deposit_minor`, `rent_due_day` (1–28), `status` (`draft` | `active` | `signed` | `ended` | `terminated`), `signed_at`, `signed_by_user_id`, `created_at`.
- **Indexes:** `(organization_id, unit_id, status)`, `(organization_id, end_date)`.
- **Exclusion constraint (no double-lease):** `EXCLUDE USING gist (unit_id WITH =, daterange(start_date, end_date, '[)') WITH &&) WHERE (status IN ('active', 'signed'))`. Requires `btree_gist` extension.
- **Immutability trigger:** on `status = 'signed'`, reject any `UPDATE` that changes `monthly_rent_minor`, `currency`, `security_deposit_minor`, `start_date`, `end_date`, `unit_id`, or `rent_due_day`. Status transitions still allowed.

**`lease_tenants`** (join)
- `lease_id`, `contact_id`, `role` (`primary` | `co_tenant` | `guarantor`).
- **PK:** `(lease_id, contact_id, role)`.

**`bookings`** (short-term)
- `id`, `organization_id`, `unit_id`, `check_in`, `check_out`, `nightly_rate_minor` (snapshot), `total_amount_minor` (computed, stored), `currency`, `status` (`tentative` | `confirmed` | `checked_in` | `checked_out` | `cancelled`), `primary_contact_id`, `channel` (`direct` | `airbnb` | `booking_com` | `other`), `notes`, `created_at`.
- **Index:** `(organization_id, unit_id, check_in, check_out)` — the availability hot path.
- **CHECK:** `check_out > check_in`.
- **Exclusion constraint (no double-book):** `EXCLUDE USING gist (unit_id WITH =, daterange(check_in, check_out, '[)') WITH &&) WHERE (status NOT IN ('cancelled', 'tentative'))`.

**`booking_guests`**
- `booking_id`, `contact_id` (nullable), `guest_name`, `created_at`.

**`payments`** (manual)
- `id`, `organization_id`, `lease_id` (nullable), `booking_id` (nullable), `contact_id` (nullable), `amount_minor` (integer), `currency`, `method` (`cash` | `bank_transfer` | `check` | `other`), `reference`, `received_at`, `recorded_by_user_id`, `notes`, `created_at`.
- **CHECK + trigger:** at most one of `lease_id` / `booking_id` is non-null, or both null (unapplied deposit).
- **Indexes:** `(organization_id, lease_id, received_at)`, `(organization_id, booking_id, received_at)`.
- **Idempotency:** unique index on `(organization_id, idempotency_key)` where `idempotency_key` is set.

**`invoices`** (long-term, generated)
- `id`, `organization_id`, `lease_id`, `period_start`, `period_end`, `amount_due_minor`, `amount_paid_minor` (synced from payments), `due_date`, `status` (`draft` | `sent` | `partially_paid` | `paid` | `overdue`), `sent_at`, `created_at`.
- **Indexes:** `(organization_id, lease_id, period_start)`, `(organization_id, status, due_date)`.

**`maintenance_tickets`**
- `id`, `organization_id`, `unit_id`, `reported_by_contact_id` (nullable), `assigned_to_user_id` (nullable), `title`, `description`, `priority` (`low` | `medium` | `high` | `urgent`), `status` (`open` | `in_progress` | `resolved` | `cancelled`), `created_at`, `resolved_at`.
- **Index:** `(organization_id, status, priority)`.

**`cleaning_schedules`**
- `id`, `organization_id`, `unit_id`, `booking_id` (nullable), `scheduled_date`, `assigned_to_user_id` (nullable), `status` (`pending` | `in_progress` | `done`), `notes`, `created_at`.
- **Index:** `(organization_id, scheduled_date, status)`.

**`documents`** (polymorphic)
- `id`, `organization_id`, `owner_table`, `owner_id`, `storage_key`, `original_filename`, `mime_type`, `size_bytes`, `uploaded_by_user_id`, `created_at`.
- **Index:** `(owner_table, owner_id)`.

**`system_settings`** (super-admin only)
- `key` (PK), `value` (jsonb), `description`, `updated_by_user_id`, `updated_at`.
- Keys: `smtp.host`, `smtp.port`, `smtp.user`, `smtp.password` (**encrypted**), `smtp.use_tls`, `smtp.from_address`, `app.name`, `app.default_currency`, `app.default_timezone`, `app.min_password_length`, `backup.target`, `backup.credentials` (**encrypted jsonb**), `reminder.lease_expiration_days` (e.g., [60, 30, 7]), `reminder.rent_due_days` (e.g., [-3, 0, 3]).

**`audit_log`** (append-only)
- `id`, `organization_id` (nullable), `user_id`, `impersonated_by_super_admin_id` (nullable), `action`, `entity_table`, `entity_id`, `before` (jsonb), `after` (jsonb), `ip`, `user_agent`, `request_id`, `created_at`.
- **Index:** `(organization_id, created_at)`, `(user_id, created_at)`.

**`sessions`**
- `id` (opaque 256-bit), `user_id`, `organization_id` (for org sessions) or NULL (for super-admin sessions), `created_at`, `last_seen_at`, `expires_at`, `ip`, `user_agent`, `revoked_at` (nullable).

**`admin_sessions`**
- Same shape, used only by super-admins. Separate table so a cross-tenant session escalation is structurally impossible.

**`password_reset_tokens`**
- `id`, `user_id`, `token_hash` (Argon2id of the token), `expires_at`, `used_at` (nullable), `created_by_user_id` (nullable — set when admin-triggered), `delivery_method` (`email` | `displayed_to_admin` | `both`).

**`user_invitations`**
- `id`, `organization_id`, `email`, `token_hash`, `expires_at`, `accepted_at`, `invited_by_user_id`.

### Storage types

| Data | Storage | Why |
|---|---|---|
| Structured data | **PostgreSQL 16** | ACID, joins, RLS, exclusion constraints, tsvector for search |
| Files | **Local volume** behind `StorageProvider` (S3-compatible alt) | Discussed in §2 |
| Cache | **None in v1** | Postgres handles the load |
| Search | **Postgres `tsvector` + GIN** | Free, fast at this scale; Meilisearch later if needed |

### ORM and migrations

- **Prisma** as the ORM (type-safe, AI-tooling-friendly, integrates with pg-boss via raw SQL).
- **Prisma Migrate** for schema changes; every migration in git, no in-place fixes.
- **Seed script** for development: 1 super-admin + 1 demo org with units, leases, bookings, contacts.
- **Thin `withOrgContext(orgId, fn)` wrapper** that sets the RLS setting at the start of every transaction. The rest of the app never thinks about RLS.

---

## 4. API Design (Phase 4)

### Style: REST at `/api/v1/...`, JSON only

REST chosen over tRPC for portability, AI-tooling fit, and future mobile/third-party client flexibility. Type safety comes from **Zod schemas as the single source of truth** for request/response contracts — TypeScript types derived via `z.infer`. ~80% of tRPC's developer-experience win, without locking out non-TypeScript clients.

### Conventions

- **IDs:** server-generated UUIDs, never client-supplied.
- **Timestamps:** UTC ISO 8601 in the API, user's timezone in the UI.
- **Money:** integer minor units + ISO 4217 currency code (e.g., `amount_minor: 125000, currency: "USD"` = $1,250.00). Never floats.
- **Pagination:** cursor-based on all list endpoints. `?cursor=...&limit=50` (default 50, max 200). No offset.
- **Versioning:** URL-based (`/api/v1/`). v2 is additive in code structure (separate `app/api/v2/` directory, shared services).

### Endpoint shape (representative)

```
GET    /api/v1/units
POST   /api/v1/units
GET    /api/v1/units/:id
PATCH  /api/v1/units/:id
DELETE /api/v1/units/:id                              # soft-delete

GET    /api/v1/leases
POST   /api/v1/leases
GET    /api/v1/leases/:id
PATCH  /api/v1/leases/:id                            # 409 if signed
POST   /api/v1/leases/:id/sign                       # transition to signed
POST   /api/v1/leases/:id/terminate

GET    /api/v1/bookings
POST   /api/v1/bookings                              # 409 on overlap
GET    /api/v1/bookings/:id
PATCH  /api/v1/bookings/:id
POST   /api/v1/bookings/:id/cancel

GET    /api/v1/units/:id/availability?from=&to=      # {available: bool}
GET    /api/v1/units/:id/quote?from=&to=             # {nights, nightly_rate_minor, total_minor, currency}

GET    /api/v1/leases/:id/documents
POST   /api/v1/leases/:id/documents                  # multipart
GET    /api/v1/documents/:id                         # 302 to signed URL
DELETE /api/v1/documents/:id

GET    /api/v1/payments
POST   /api/v1/payments                              # Idempotency-Key header
GET    /api/v1/payments/:id

POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/invite

GET    /api/v1/admin/settings
PATCH  /api/v1/admin/settings
POST   /api/v1/admin/settings/smtp/test
```

### Error envelope (every non-2xx response)

```json
{
  "error": {
    "code": "string_code",
    "message": "Human-readable, safe to show",
    "details": {},
    "request_id": "uuid"
  }
}
```

| Status | Meaning | Examples |
|---|---|---|
| 400 | Validation error | Zod-flattened details |
| 401 | Not authenticated | |
| 403 | Not authorized | Cross-org access, non-admin writes |
| 404 | Not found (or soft-deleted, or wrong org — never disclose which) | |
| 409 | Conflict | `lease_collision`, `booking_collision`, `lease_signed_immutable`, `unit_blocked`, `payment_already_applied` |
| 429 | Rate limited | |
| 5xx | Server error | Generic message; real error logged with `request_id` |

### Idempotency

`POST /payments` and `POST /bookings` accept an `Idempotency-Key: <uuid>` header. The server stores the key + result for 24h; a retry with the same key returns the original result. Prevents the "user double-clicked submit, now there are two payments" bug.

### Request correlation

Every response includes `X-Request-Id: <uuid>`. Same ID is in error envelopes, in the audit log, and in Sentry. The super-admin UI can search the audit log by `request_id` to answer "what happened on this request."

---

## 5. Auth & Security (Phase 5)

### Authentication: server-side sessions

- **Cookie:** `sid=<opaque 256-bit session id>`. `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age=30 days` (sliding).
- **The cookie holds only a lookup key.** No user ID, no role, no org, no permissions. Everything else lives in the `sessions` table.
- **Why server-side sessions, not JWTs:** instant revocation (delete the row), per-session metadata (IP, UA, last seen), simpler model, no XSS-via-`localStorage` risk, and a `sessions` table is one lookup per request — negligible at 250 users.
- **Super-admin sessions** use a separate cookie name (`sid_admin`) and a separate `admin_sessions` table. A separate login page is the only way to create one. A compromise of an org session cannot escalate to a super-admin session.
- **On every protected request:** middleware reads the cookie → looks up the session → attaches `user_id`, `organization_id`, `role` to the request context → the route handler uses that context. RLS is set from this context. The client is never trusted for any of these.
- **Revocation:** logout, password change, admin-triggered password reset, org suspension, "log out everywhere" — all delete the relevant `sessions` rows. Immediate.

### The "balanced" client role (UI only)

The server returns a small read-only summary to the client at page load for UI rendering:

```json
{ "user_id": "...", "organization_id": "...", "role": "agent", "display_name": "Jane Smith" }
```

This is **data, not authority.** The UI uses it to hide buttons and render nav links. The server ignores it for authorization and re-checks everything from the session row. A user editing this in devtools has no effect.

### Password handling

- **Hashing:** Argon2id, `m=64MB, t=3, p=1` (tune up if VM has headroom).
- **Minimum length:** configurable in `system_settings` (`app.min_password_length`, default 12). You define the rest of the complexity policy.
- **Breach check:** HaveIBeenPwned k-anonymity API at signup and password change. Rejects known-leaked passwords. The HIBP endpoint only sees the first 5 chars of the SHA-1 hash, so the password is not transmitted.
- **No forced rotation** in v1. Rotate on suspected compromise.
- **Storage:** `users.password_hash`, plus `password_changed_at` and `password_must_change` (true after admin reset → forces change on next login).

### Password reset — admin-triggered

**Flow:**

1. `org_admin` (for `agent` users in their org) or `super_admin` (for any user) opens a user's record and clicks "Reset password."
2. Server generates a strong random password (16 chars, alphanumeric + symbols).
3. Server hashes with Argon2id, sets `password_hash`, `password_changed_at = now`, `password_must_change = true`.
4. **Server invalidates all existing sessions for that user** (force-logout-everywhere).
5. Server returns the plaintext password **once, in the response to the admin** ("copy this and send it securely").
6. **Email option:** if SMTP is configured and the admin ticks "also email the new password," the server emails it. **The email checkbox is hidden in the UI if SMTP is not configured** — no silent failure, no half-configured state.
7. **Reset token expires in 24h** (controlled by `password_must_change` — after 24h, login with the temp password is rejected).
8. **Audit-logged** with `actor_user_id`, `target_user_id`, `delivery_method`, `ip`.

**Restrictions:**
- `org_admin` can reset `agent` users in their own org. **Cannot** reset another `org_admin`.
- `super_admin` can reset any user, including other `super_admins`.
- Plaintext password is shown in the admin UI **once**. Not logged, not stored anywhere recoverable.

**Security note (flagged, not changed):** emailing a plaintext password is risky (email is not confidential, sits in backups). The reset-link model is more secure, but you chose the auto-generated model. The admin UI shows a warning: *"This password will be sent in plain text — use a secure channel to share it if you're not emailing it."*

### Self-service password reset (user-initiated)

- "Forgot password" form takes an email, emails a one-time signed token (32 random bytes, hashed at rest in `password_reset_tokens`, 1-hour expiry, single-use).
- User clicks link → sets a new password → sessions invalidated, audit-logged.

### Authorization: RBAC

| Role | Scope | Capabilities |
|---|---|---|
| `super_admin` | Global | All orgs, system settings, impersonation (audit-logged), user management across orgs |
| `org_admin` | One org | Manage users (agents), units, contacts, leases, bookings, payments, settings within their org |
| `agent` | One org | Day-to-day operations: record payments, create bookings/leases, view reports. No user management, no org settings. |

**Enforced in three layers (defense in depth):**

1. **Middleware** — session valid? (else 401)
2. **Route handler** — `requireRole('org_admin')` (else 403)
3. **Database (RLS)** — `organization_id` filter at the DB level. A bug in the app cannot leak across orgs.

**Per-row ownership** (`created_by_user_id` on maintenance tickets) handles the "this agent should only see tickets assigned to them" case without needing ABAC. ABAC can be added later if the role list grows past 4–5.

**Super-admin impersonation** is built in v1:

- Super-admin clicks "Impersonate Jane (org_acme)" in the admin UI.
- A new `impersonation_sessions` row links the super-admin's real session to Jane.
- The session context switches to act as Jane, with a visible banner: *"You are impersonating Jane Smith (Acme Rentals). [Stop impersonating]"*
- Every action is recorded in `audit_log` with `impersonated_by_super_admin_id`.
- Stop impersonating → restores the real session.

### Secrets management

- **`.env` file on the VM**, `chmod 600`, owner = Docker user, gitignored.
- **Contents:** `DATABASE_URL`, `SESSION_COOKIE_SECRET`, `SETTINGS_ENCRYPTION_KEY`, `SENTRY_DSN` (optional), and any other app-level secrets.
- **`docker-compose.yml`** injects via `env_file:`. **No secrets in the image, no secrets in git, no secrets in logs.**
- **Per-tenant / per-org secrets configured from the admin panel** (SMTP, backup target) are stored **encrypted at rest in `system_settings`** using `pgcrypto` with a key derived from `SETTINGS_ENCRYPTION_KEY`.
- **Rotation procedures** documented in the runbook:
  - `SESSION_COOKIE_SECRET` rotation → invalidates all sessions, users re-login. Acceptable.
  - `SETTINGS_ENCRYPTION_KEY` rotation → uses the `key_id` column on encrypted values for non-disruptive rotation.
  - DB password rotation → brief app+DB restart.

### Threat surface and defenses

| Threat | Defense |
|---|---|
| Cross-tenant data leak | RLS + `organization_id` on every query + super-admin uses bypass-RLS role only |
| XSS | React default escaping + CSP header (set by Caddy) + lint rule banning `dangerouslySetInnerHTML` |
| CSRF | SameSite=Lax cookies + double-submit CSRF token on all state-changing requests (POST/PATCH/DELETE) |
| SQL injection | Prisma parameterizes everything; raw SQL only via `$queryRaw` tagged templates, linted for unsafe patterns |
| Session hijacking | HttpOnly + Secure + SameSite cookies + server-side session row, instantly revocable |
| Brute force login | Per-IP and per-account rate limit on `/auth/login` (5 attempts / 15 min, exponential backoff, account lockout after 10) |
| File upload abuse | Multipart size limits, MIME sniffing (don't trust client `Content-Type`), randomize stored filenames, never serve from web root in local mode |
| Open redirect | Login redirects validated against an internal allowlist |
| Secrets in logs | Centralized redaction in the logger; Sentry scrubber configured |
| Dependency CVEs | `pnpm audit` in CI; Dependabot/Renovate auto-PRs for high/critical |
| TLS | Caddy auto-issues and auto-renews Let's Encrypt; HTTP→HTTPS redirect; HSTS header |
| Backups at rest | Encrypted client-side (e.g., `age` or `gpg`) before upload to offsite bucket |

**Not in v1 (be honest about it):** WAF, login anomaly detection, 2FA (v1.1), SOC 2 / ISO certification, ABAC.

### Logging and observability

- **Structured logs** (JSON) to stdout, tags: `request_id`, `user_id`, `organization_id`, `route`, `status`, `duration_ms`.
- **Health endpoint** at `/api/health` (no auth): DB connection, pg-boss queue depth, version. Hit by the external uptime monitor every 60s.
- **Sentry** (or self-hosted GlitchTip) for error tracking. App degrades gracefully if `SENTRY_DSN` is absent.
- **Audit log** queryable from the super-admin UI. *"Show me every action by user X in the last 7 days."*

### Compliance posture for v1

- **GDPR-friendly by default:** `data_export` endpoint (returns the user's full record as JSON), `delete_account` endpoint (soft-deletes the user, anonymizes PII in audit log, hard-deletes from `contacts` after 30-day grace period), `consent` flag on contacts.
- **No formal certification** in v1.
- **Data residency** = VM region. (Pick EU if GDPR matters; pick US otherwise.)

### Security non-negotiables (the floor)

In rough order of "last to cut":

1. Postgres RLS on every tenant-scoped table
2. Argon2id + HIBP password check
3. Server-side sessions with instant revocation
4. CSRF protection on state-changing requests
5. Offsite encrypted backups with a tested restore procedure
6. TLS via Caddy, auto-renewed
7. External uptime monitor
8. Idempotency keys on payments and bookings
9. Audit log (who-did-what)
10. Rate limiting on auth endpoints
11. Sentry (or self-hosted alternative) for error visibility
12. 2FA for `org_admin` and `super_admin` *(deferred to v1.1 — your call to pull into v1)*

---

## 6. Deployment and Operations

### The `docker-compose.yml` (shape)

```yaml
services:
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

  app:
    build: .
    command: ["node", "server.js"]
    env_file: .env
    depends_on: [db]
    networks: [internal]
    # NOT exposed to host; Caddy talks to it via the internal network

  worker:
    build: .
    command: ["node", "worker.js"]
    env_file: .env
    depends_on: [db]
    networks: [internal]

  db:
    image: postgres:16-alpine
    env_file: .env
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks: [internal]
    # NOT exposed to host

  backup:
    build: ./docker/backup
    env_file: .env
    volumes:
      - pgdata:/var/lib/postgresql/data:ro
      - storage:/storage:ro
    networks: [internal]
    # Runs nightly; pushes to offsite bucket

volumes:
  pgdata:
  storage:
  caddy_data:
  caddy_config:

networks:
  internal:
```

### Pre-launch checklist (the things that protect the SLA)

- [ ] `.env` created with all required secrets, `chmod 600`
- [ ] `docker compose up -d` works; all containers healthy
- [ ] `/api/health` returns 200 from outside the VM
- [ ] Uptime monitor configured to ping `/api/health` every 60s
- [ ] Offsite backup destination configured via admin panel
- [ ] **Restore drill performed** at least once (the only test that proves backups work)
- [ ] SMTP configured via admin panel; test email sent successfully
- [ ] OS auto-updates enabled (`unattended-upgrades` on Ubuntu)
- [ ] Firewall configured: only 80/443 open to the public
- [ ] Let's Encrypt certs issued and auto-renewing
- [ ] Sentry (or GlitchTip) configured
- [ ] Runbook written: how to deploy, how to restore, how to rotate secrets, how to debug common issues

---

## 7. Open Items (small, not architectural)

| Item | Owner | Status |
|---|---|---|
| Pick VM region (US / EU) | You | Pending — affects GDPR posture |
| Pick backup vendor (Backblaze B2 default) | You | Pending — config in admin panel, not code |
| Pick error tracking (Sentry / GlitchTip self-host) | You | Pending — env var controls |
| 2FA in v1 vs. v1.1 | You | Deferred to v1.1 unless you say otherwise |
| Minimum password length (default 12) | You | Configurable in `system_settings` |
| Sentry self-host vs. cloud | You | Sentry cloud free tier is the default |

---

## 6.5. Product Behavior Contracts

The architecture defines *what the system is made of*. This section locks down the *load-bearing product behavior* — the business rules that, if not nailed down here, become implementation ambiguity. Anything not specified here is intentionally left to the implementation, and any change to these contracts requires updating this document first.

### 6.5.1. Lease lifecycle

A `lease` is the central object of long-term rentals. The state machine is:

```
   draft ──▶ active ──▶ signed ──▶ ended
     │         │          │
     │         │          └──▶ terminated
     │         └──▶ terminated
     └──▶ cancelled (only from draft; never after activation)
```

| From → To | Trigger | Who | Side effects |
|---|---|---|---|
| `draft` → `active` | Org admin or agent | User has `leases:write` | Lease is now discoverable by the nightly invoice rollup job. No immutability yet. |
| `draft` → `cancelled` | Org admin or agent | User has `leases:write` | Lease is hidden from active views. Soft-deleted. |
| `active` → `signed` | Org admin | User has `leases:sign` | **Immutability trigger fires** (see §3 — schema). First invoice generated by the rollup job. Confirmation email sent to all `lease_tenants`. |
| `active` → `terminated` | Org admin | User has `leases:write` | Used for leases that were activated but never formally signed (e.g., tenant backed out). No immutability. |
| `signed` → `ended` | Org admin or job | User has `leases:write`, OR the daily job when `end_date < today` | Lease's end-of-term notice is sent. No more invoices generated. Property is released for new leases/bookings. |
| `signed` → `terminated` | Org admin only | User has `leases:terminate` (org_admin only) | Early termination. Records the `terminated_at` and `terminated_reason` (text). Remaining invoices are marked `cancelled`. |

**Hard rules:**
- A `signed` lease's `monthly_rent_minor`, `currency`, `security_deposit_minor`, `start_date`, `end_date`, `unit_id`, or `rent_due_day` **cannot be changed**. Any change is a new lease; the old one is `ended` or `terminated`.
- The `unit_id` cannot be changed on any non-cancelled lease (it would invalidate the unit's exclusion constraint).
- A lease cannot move from `signed` back to `draft` or `active`. There is no "un-sign."

**Renewal is a new lease**, not a modification. The UI's "Renew" action pre-fills a new lease with the previous one's data and the org admin adjusts the dates and rent.

### 6.5.2. Booking lifecycle

A `booking` is the central object of short-term rentals. The state machine is:

```
   tentative ──▶ confirmed ──▶ checked_in ──▶ checked_out
       │             │              │
       └──▶ cancelled└──▶ cancelled  └──▶ cancelled (with cancellation fee, if configured)
```

| From → To | Trigger | Who | Side effects |
|---|---|---|---|
| `tentative` → `confirmed` | Org admin or agent | User has `bookings:write` | Booking is now counted in availability. Confirmation email sent to primary contact. |
| `tentative` → `cancelled` | Org admin or agent | User has `bookings:write` | No fee (no contract yet). |
| `confirmed` → `checked_in` | Org admin or agent | User has `bookings:checkin` | `check_in_actual_at` recorded. Cleaning schedule for `check_out + 1 day` is enqueued. |
| `confirmed` → `cancelled` | Org admin only | User has `bookings:cancel` (org_admin only, agents cannot cancel confirmed bookings) | Cancellation policy applied (see §6.5.6). |
| `checked_in` → `checked_out` | Org admin or agent | User has `bookings:checkin` | `check_out_actual_at` recorded. Triggers the cleaning schedule generation job. |
| `checked_in` → `cancelled` | Disallowed. | — | A checked-in guest leaving requires a manual refund record and a status change to `checked_out` with notes. |

**Hard rules:**
- A `tentative` booking does **not** block availability for other tentative bookings on the same unit; it does not block for confirmed bookings either, but the exclusion constraint at the DB level will reject the second one.
- The `check_in_actual_at` and `check_out_actual_at` are independent of `check_in` and `check_out` (the planned dates). The planned dates drive availability; the actual dates drive reporting.
- Channel attribution (`channel` column) can be set on creation and edited by org_admin before `checked_in`. After `checked_in`, the channel is read-only (immutable for reporting integrity).

### 6.5.3. Availability precedence

The "is this unit available on date X?" check is the most-called read path. The precedence, evaluated in this order, is:

1. **Active or signed lease** covers date X → **not available** (return `available: false`, reason: `lease`).
2. **Confirmed, checked_in, or checked_out booking** (i.e., anything not `tentative` or `cancelled`) covers date X → **not available** (reason: `booking`).
3. **`unit_blocked_date` row** covers date X with a reason of `owner_use`, `maintenance`, or `other` → **not available** (reason: `blocked`).
4. **`unit_availability_rule` row** matches the day-of-week and the booking's `rental_type` is `short_term` and the rule's `applies_to` includes `short_term` → **not available** (reason: `policy`).
5. Otherwise → **available**.

The availability API returns both the boolean and the reason code, so the UI can show "blocked for maintenance until June 15" rather than a generic "unavailable." When the unit is genuinely free, the reason is `null`.

### 6.5.4. Pricing conflict resolution

For short-term pricing, the algorithm to determine the nightly rate for `unit X` on `date D` is:

1. Collect all `rate_plans` for `unit X` where any `rate_plan_period` row covers `date D`.
2. Among those, pick the plan with the **highest `priority`** (int column; higher wins).
3. If multiple plans tie on priority, pick the **most recently created** (`rate_plans.id` is UUIDv7, so creation order is encoded).
4. If no plan's period covers `date D`, fall back to the plan with `is_default = true` for the unit.
5. If no default plan exists, return a clean error from the quote API (`no_rate_for_date`) — **never** default to zero, and never invent a price.

For long-term pricing, the rate lives on the lease and is immutable once signed. The nightly/mid-month prorations happen at the invoice level (see §6.5.6), not the lease level.

### 6.5.5. Soft delete and retention matrix

| Entity | Soft delete by default? | Hard delete? | Retention after hard delete | Audit log retained? |
|---|---|---|---|---|
| `organizations` | Yes | Only if no `users`, `units`, `leases`, `bookings` exist | After hard delete: 30-day grace period, then purged | Forever (anonymized) |
| `users` | Yes (status = `deactivated`) | No (kept for audit) | N/A | Forever (immutable) |
| `units` | Yes (status = `archived`) | Only if no `leases`/`bookings` ever referenced it | N/A — soft-delete is the lifetime state | Forever (immutable) |
| `contacts` | Yes (deleted_at) | After 30-day grace if no open leases/bookings | PII hard-deleted; pseudonymized tombstone in audit log | Forever (pseudonymized) |
| `leases` | Never (status reflects lifecycle) | Never (legal record) | N/A | Forever |
| `bookings` | Never (status reflects lifecycle) | Never (financial record) | N/A | Forever |
| `payments` | Never | Never (financial record) | N/A | Forever |
| `documents` | Yes (deleted_at) | On user request or retention expiry | Per the retention rule of the owning entity | Tombstone only |
| `audit_log` | Never | Never (append-only) | N/A | Forever |

**The "never delete" entities are required for legal, tax, and dispute-resolution reasons.** Soft-delete is the user-facing concept; hard-delete is the data-lifecycle concept; audit log is the regulatory record.

### 6.5.6. Payment, invoice, and refund rules

**Payments (manual entry):**
- A payment applies to at most one `lease` or `booking`, or to nothing (unapplied deposit).
- Partial payments are supported. A lease's `invoices.amount_paid_minor` is the sum of all `payments.amount_minor` where `lease_id` matches and `received_at <= invoice.due_date + grace_period`.
- Overpayments are allowed — the excess is recorded as `unapplied_balance` on the lease, available to be moved to the next period by org_admin.
- **Refunds and voids** are recorded as **negative-amount `payments` rows** with `method = 'refund'` or `void`. They are never `UPDATE` or `DELETE` on the original payment. The `audit_log` records the link.
- **Idempotency:** every `POST /payments` requires an `Idempotency-Key` header. A retry within 24h returns the original result. (See §4 — API design.)

**Invoices (long-term, generated nightly):**
- The nightly rollup job, for each `active` or `signed` lease, generates the next invoice for the current `rent_period` if one does not already exist.
- The job is **idempotent**: it checks for the existence of `invoices(lease_id, period_start)` before creating, and never duplicates.
- The default invoice period is one calendar month. Proration is **out of scope for v1**: if a lease starts mid-month, the first invoice is for the partial month at the full `monthly_rent_minor`, and the next invoice is the full month. (This is the simplest and most common convention.)
- **Late fees** are **out of scope for v1**. Overdue status is reported (the `invoices.status` transitions to `overdue` after `due_date + grace_period_days` via a daily job, default 5 days), but no automatic fee is applied. Org admins can record a late fee as a separate `payments` row.
- Manual override: org_admin can edit a `draft` invoice's `amount_due_minor` and `due_date` before it's sent. A `sent` invoice cannot be edited — corrections are negative-amount payments.

**Security deposits:**
- The `leases.security_deposit_minor` field records the deposit amount. The actual cash is tracked as `payments` with `method = 'deposit'` and an unapplied balance.
- When the lease ends, the deposit is returned (refund payment) or partially applied to damages (a transfer from `unapplied_balance` to a `payments` row tied to a damage note, with org_admin approval).
- **In v1, this is bookkeeping only** — the app does not hold funds. Org admin does the math; the app records the entries.

### 6.5.7. Notification matrix

Notifications are **email-only in v1**. The SMTP configuration (see §5) is the only delivery mechanism. In-app notifications are out of scope for v1.

| Event | Trigger | Recipients | Template | Notes |
|---|---|---|---|---|
| Rent due (T-N) | Daily job, configurable offset (default T-3) | All `lease_tenants` where `role = 'primary'` | `rent_due` | One email per lease per offset day. |
| Rent overdue | Daily job, runs on `invoices.due_date + grace_period` | Primary tenant + org admins | `rent_overdue` | Sent once. |
| Lease expiring | Daily job, configurable offsets (default T-60, T-30, T-7) | Primary tenant + org admins | `lease_expiring` | One per offset. |
| Lease signed | On `lease.status → signed` | All `lease_tenants` + org admins | `lease_signed` | One-time. |
| Lease ended | On `lease.status → ended` | Primary tenant + org admins | `lease_ended` | One-time. |
| Booking confirmation | On `booking.status → confirmed` | Primary contact | `booking_confirmed` | Includes check-in details. |
| Booking cancellation | On `booking.status → cancelled` | Primary contact + org admins | `booking_cancelled` | Includes refund info if applicable. |
| Check-in instructions | Daily job, T-1 day before `check_in` | Primary contact | `check_in_instructions` | Includes door code, Wi-Fi, etc. (configurable per unit in v1.1). |
| Password reset | User-initiated | The user | `password_reset` | Standard one-time link. |
| Invitation | Org admin invites a teammate | The invitee | `invitation` | One-time signup link. |
| Admin password reset | Super admin or org admin triggers | The admin (UI display) + optionally the user (email) | `admin_password_reset` | UI shows the password once; email is opt-in. |

**Templating in v1:** a single global template per event, stored in code (not in the admin panel). Per-tenant template customization is **out of scope for v1**. Per-tenant sender identity (the `from_address`) is configurable in `system_settings` (SMTP setting) but the email body is the global template.

**Failure handling:** if an email fails to send, the pg-boss job retries with exponential backoff (3 attempts, 1min / 10min / 1hr). After 3 failures, the job is marked `failed` and surfaces in the admin "Failed jobs" view. No automatic alert to the org admin in v1 — the admin UI surfaces failed jobs on next login.

### 6.5.8. Maintenance and cleaning workflows

**Maintenance tickets:**
- Created by: `org_admin` or `agent` (tenants/guests are not users in v1; if a tenant reports an issue, the agent creates the ticket on their behalf and sets `reported_by_contact_id`).
- States: `open → in_progress → resolved`, with `cancelled` available from `open` or `in_progress`.
- **Comments and attachments** are required for v1: each ticket has a comment thread (`maintenance_comments` table, not in the original schema — see PRD for the addition) and supports attached photos. Status changes are recorded as system comments.
- **SLA reporting is out of scope for v1**. The schema records `created_at` and `resolved_at`, so a v1.1 report can compute "median time to resolve by priority."

**Cleaning schedules:**
- Auto-generated: for every booking's `check_out` (planned), the post-checkout job creates a cleaning schedule for `check_out + 1 day`. Daily forward-look job creates schedules for the next 7 days.
- Manual adjustment: org_admin can move a cleaning date, reassign, or mark `done` early.
- **Cleaners are not system users in v1.** Cleaners receive a calendar export (iCal feed, per unit) generated by the org admin. The cleaner checks off a job in person, the org admin marks it `done` in the app.
- A missed cleaning is just a schedule that stays in `pending` past its date; it shows up red in the org admin's dashboard.

### 6.5.9. Contacts: a single table, multiple roles

A `contacts` row can simultaneously be a tenant on one lease, a guarantor on another, a guest on a booking, and the payer on a payment. The semantics are determined by the **join rows**, not by the contact itself. There is no "type" column on `contacts`.

- The `email` and `phone` are unique per `organization_id` (a contact can have the same email in two different orgs).
- A contact is soft-deleted if they have no open leases/bookings. They are **never hard-deleted while they are referenced** in any non-soft-deleted record.
- The `id_document_number` field is encrypted at rest (see §3); only org_admin can view it; agents see a redacted "•••-1234" hint.

### 6.5.10. Operational acceptance criteria

These are the targets the system is built to meet. Anything not in this table is not a v1 commitment.

| Metric | Target | Notes |
|---|---|---|
| Concurrent users supported | 250 baseline, 2,500 headroom | Single VM, single Postgres. |
| `/api/health` response (p95) | < 100ms | No auth, no DB writes. |
| `/api/v1/units/:id/availability` (p95) | < 300ms | Hits the exclusion-constraint-backed index. |
| `/api/v1/bookings` POST (p95) | < 500ms | Includes rate plan resolution and RLS check. |
| `/api/v1/auth/login` (p95) | < 800ms | Includes Argon2id verify. |
| `/api/v1/payments` POST (p95) | < 400ms | Idempotency key check is a single index hit. |
| Uptime | 99.5% (~3.6h downtime/month) | "Minimum downtime" target. |
| RPO (max data loss on disaster) | 1 hour | Last successful offsite backup. |
| RTO (time to restore from backup) | 4 hours | Restore drill documented in the runbook. |
| Backup window (full pg_dump) | < 30 minutes | B2 or S3 upload. |
| Tenant data isolation | Database-enforced (RLS) | App layer also scopes; DB is the safety net. |

---

## 8. What this is not (expanded)

To keep the boundaries explicit, the following are **deliberately out of scope for v1**. They are listed here so they are not mistaken for oversights, and so the v1.1 / v2 candidates are visible:

### Not in v1 (deliberate deferrals)

- **Tenant portal, guest portal, owner portal, vendor portal.** Only back-office users (`org_admin`, `agent`, `super_admin`) authenticate. External actors receive notifications by email but do not have system access.
- **Multi-currency within a single org.** Each org has a single base currency. Multi-currency is a v2 feature.
- **Multi-language UI.** Single-language (English) UI in v1. All data fields accept Unicode; only the chrome is English.
- **E-signature integration** (DocuSign, HelloSign, native). Lease signing is a status transition (see §6.5.1) recorded manually by org_admin. The signed lease PDF is uploaded as a `document`.
- **Channel manager sync** (Airbnb, Booking.com, Vrbo). Bookings are entered manually. The `bookings.channel` column is for future sync.
- **Payments processor integration** (Stripe, etc.). All payments are manual entries. No PCI scope.
- **Document versioning.** A new upload replaces the old; the old is not retained.
- **Virus / malware scanning on uploads.** Out of scope. (S3-compatible providers can add this later via Lambda / worker.)
- **In-app notifications.** Email only.
- **Per-tenant email template customization.** Single global template per event.
- **Per-tenant branding** (logo, color, custom domain).
- **Mobile app** (native or React Native).
- **Real-time updates** (WebSockets, SSE). Refresh to see changes.
- **WAF, login anomaly detection, ABAC, 2FA, SOC 2 / ISO certification.**
- **Custom reports beyond the default set** (overdue invoices, occupancy, payment ledger, lease roster, maintenance backlog).
- **Calendar / iCal feeds.** Cleaning staff need to be coordinated manually in v1.

### Architectural scope (unchanged from before)

- **Not microservices.** One app, one DB, one VM.
- **Not cloud-native in the K8s sense.** Docker Compose on a single VM.
- **Not "ready to scale to millions."** 250 baseline, 2,500 headroom.
- **Not zero-ops.** You own the VM, the backups, the monitoring, the secret rotation, the OS patches.

---

## 9. Cross-references

- **Product Requirements Document (PRD):** see [`product-requirements.md`](./product-requirements.md). The PRD is the home for *what the product should do*; this document is the home for *what the system is made of and how it behaves at the architectural level*. They cross-reference each other.
- **Sections 6.5.x of this document** (the Product Behavior Contracts) are the load-bearing product decisions extracted from the PRD. If a product decision changes, edit it here AND in the PRD.

---

**End of document.**
