# Rental Management SaaS — Product Requirements Document

**Version:** 1.0 (v1 scope)
**Status:** Approved for build
**Date:** 2026-06-11
**Companion to:** [`architecture.md`](./architecture.md)

---

## 0. About this document

This is the **Product Requirements Document (PRD)** for the rental management SaaS. Its purpose is to define *what the product should do* — the user-facing behavior, the business rules, the workflows, and the boundaries of v1.

It is **not** an architecture document. The technical decisions (stack, deployment, schema, API style, security) live in [`architecture.md`](./architecture.md), and the two cross-reference each other.

**The rule of thumb for which doc a question belongs in:**

| Question | Doc |
|---|---|
| "What does the UI look like when an org admin signs a lease?" | PRD |
| "Why did we pick Postgres?" | Architecture |
| "What happens to a booking when the guest cancels 24 hours before check-in?" | PRD |
| "How does RLS enforce tenant isolation?" | Architecture |
| "How much does it cost to run the system in production?" | Architecture |
| "What does the org admin see on the dashboard?" | PRD |

When in doubt: **if a customer could ask the question, it goes in the PRD. If only an engineer would ask it, it goes in the architecture doc.**

The architecture doc's **§6.5 Product Behavior Contracts** and **§8 What this is not (expanded)** are the canonical "what the system does at the edges" — duplicated here for narrative flow, with a link to the architecture for the technical reasoning.

---

## 1. Product overview

### 1.1 What we're building

A **multi-tenant rental management SaaS** for property managers who handle both **long-term leases** (apartments, houses, commercial units, rooms) and **short-term bookings** (vacation rentals, short-stay apartments). The product is a back-office tool used by property managers and their agents; **renters, guests, owners, and vendors are not system users in v1** — they are recorded in the data, but they interact with the system indirectly through the property manager.

### 1.2 Primary user (v1)

The **property manager** and their **agents** — the back-office staff of a rental operation. This is the only user type that logs in.

### 1.3 The user's core jobs

1. **Manage units:** create, organize, and price the rentable things (apartments, houses, vacation properties, commercial units, rooms inside a home).
2. **Manage contacts:** keep records of the people who rent — tenants, guests, guarantors — with their contact details, identity documents, and rental history.
3. **Run long-term leases:** create leases, sign them, track rent payments, generate invoices, handle renewals and terminations.
4. **Run short-term bookings:** create bookings, manage availability, handle check-ins and check-outs, manage cancellations.
5. **Get paid (manually):** record rent and booking payments as they come in, match them to leases/bookings, track outstanding balances.
6. **Coordinate operations:** schedule cleaning between bookings, track maintenance tickets, get notifications when something needs attention.
7. **Communicate:** the system sends rent reminders, lease expiration notices, booking confirmations, and other emails on the manager's behalf.
8. **Stay informed:** see overdue invoices, occupancy, and operational status at a glance.

### 1.4 What v1 is explicitly not

The full out-of-scope list lives in [`architecture.md` §8](./architecture.md#8-what-this-is-not-expanded). The high-impact items, called out here so they're visible at the product level:

- **No tenant, guest, owner, or vendor portals.** External actors receive emails but don't log in.
- **No payments processor.** All payments are entered manually.
- **No channel manager** (Airbnb / Booking.com sync). Bookings are entered manually.
- **No e-signature integration.** Lease "signing" is a status transition recorded by the org admin.
- **No mobile app.** Responsive web only.
- **No multi-currency within a single org.** One base currency per org.
- **No multi-language UI.** English only.

---

## 2. Personas and roles

The architecture defines three roles in [`architecture.md` §5.3](./architecture.md#authorization-rbac). From a product perspective:

### 2.1 `super_admin` (you, the operator)

The single human (or a very small group) who runs the SaaS. Has access to all organizations and all system settings. Used for:

- Onboarding new customer organizations.
- Debugging customer issues (via impersonation, audit-logged).
- Configuring SMTP, backup targets, and other system-wide settings.
- Suspending or reactivating organizations.

In the v1 product, this is **a single person or two**. The UI for the super_admin is a separate login page at `/admin/login` and a separate, more utilitarian dashboard at `/admin`.

### 2.2 `org_admin` (the property manager)

The "boss" of a single rental organization. Has access to everything within their organization. Used for:

- Managing users (inviting agents, removing them).
- Configuring the organization's settings (default currency, timezone, reminder offsets).
- All operational tasks an agent can do, plus the management ones above.

### 2.3 `agent` (the property manager's staff)

Day-to-day operator. Can record payments, create bookings and leases, view reports. Cannot:

- Manage other users.
- Change organization-level settings.
- Cancel confirmed bookings (only `org_admin` can).
- Terminate signed leases (only `org_admin` can).

### 2.4 Actors who are not users

- **Tenants** (long-term renters): represented as `contacts` records. Receive emails. Cannot log in.
- **Guests** (short-term renters): represented as `contacts` records. Receive emails. Cannot log in.
- **Owners / landlords** (people who own the properties): **out of scope for v1**. The product assumes the org_admin *is* the owner, or manages the properties on behalf of owners who are not in the system.
- **Cleaners, maintenance vendors**: **out of scope for v1**. They are coordinated via exported calendars or phone calls, not in-app.

---

## 3. End-to-end workflows

These are the canonical flows the product must support. Each workflow lists the actor, the trigger, the steps, and the system behavior at each step. The architecture doc's **§6.5 Product Behavior Contracts** has the precise state transitions and side effects for the entities involved.

### 3.1 Onboard a new customer organization

1. Super_admin logs into `/admin`.
2. Super_admin creates a new organization: name, primary contact name, primary contact email.
3. The system creates the organization record and sends an invitation email to the primary contact with a one-time signup link.
4. The primary contact clicks the link, sets a password, and becomes the first `org_admin`.
5. The `org_admin` can now log in at `/login` and begin setting up units, contacts, leases, and bookings.

### 3.2 Set up a property (units)

1. Org_admin goes to **Units → New Unit**.
2. Enters the unit name, kind (apartment, house, vacation property, commercial building, commercial unit, or room), address, and whether it's rentable on its own.
3. If the unit is a "container" (a house with rooms, a commercial building with units), the org_admin can later add **sub-units** (the bedrooms, the commercial bays) by clicking "Add sub-unit" on the parent.
4. For each sub-unit, the org_admin can choose to inherit the parent's address (the form pre-fills it).
5. For each rentable unit, the org_admin sets the `rental_type`: `long_term`, `short_term`, or `both`.
6. For short-term units, the org_admin sets up one or more **rate plans** (date ranges with nightly rates). There is always a "default" plan that covers dates with no specific season.

### 3.3 Add a contact (renter / guest)

1. Org_admin or agent goes to **Contacts → New Contact**.
2. Enters the contact's name, email, phone, and (optionally) ID document details.
3. The contact record is created. The contact is now available to be added to a lease or booking.
4. The same contact can be added to multiple leases and bookings over time; the system tracks their rental history automatically.

### 3.4 Create and sign a long-term lease

1. Org_admin or agent goes to **Leases → New Lease**.
2. Selects a unit, a start date, an end date, a monthly rent, a security deposit, a rent-due day, and at least one contact (as `primary` tenant). Additional contacts can be added as `co_tenant` or `guarantor`.
3. The lease is created in `draft` state. The org admin can edit any field.
4. When ready, org_admin clicks **Sign Lease**. This requires `org_admin` (agents cannot sign). The lease moves to `active` and then to `signed` (the same action transitions through both).
5. **On sign:** the lease's rent, dates, and parties become **immutable** (see [`architecture.md` §6.5.1](./architecture.md#651-lease-lifecycle)). A confirmation email is sent to all `lease_tenants`. The first invoice is generated by the next nightly rollup job.
6. Org_admin uploads a signed PDF of the lease as a `document` on the lease (out of v1: e-signature integration).

### 3.5 Record a rent payment

1. Org_admin or agent goes to **Payments → Record Payment**.
2. Selects the lease (or the booking, for short-term), the contact (optional, defaults to the lease's primary tenant), the amount, the method (cash / bank transfer / check / other), the date received, and an optional reference (e.g., "check #1234").
3. The payment is recorded. The system updates the matched invoice's `amount_paid_minor` and may transition its status (`partially_paid` → `paid`).
4. **Idempotency:** the form generates an `Idempotency-Key` per submission. A double-click or network retry won't create a duplicate (see [`architecture.md` §4](./architecture.md#4-api-design-phase-4)).

### 3.6 Create a short-term booking

1. Org_admin or agent goes to **Bookings → New Booking**.
2. Selects a unit, a check-in date, a check-out date, and a primary contact. The system shows the **quote** (nights × nightly rate, with any seasonal rate plan applied) and the **availability check** in real time.
3. The booking is created in `tentative` state. The agent can edit dates and contacts.
4. To confirm, org_admin or agent clicks **Confirm Booking**. The booking moves to `confirmed`, the unit is now blocked for those dates, and a confirmation email is sent to the primary contact.
5. On the day of check-in, the org_admin or agent marks the booking as `checked_in`, recording the actual check-in time.
6. On the day of check-out, the org_admin or agent marks the booking as `checked_out`. The system schedules a cleaning for the next day.

### 3.7 Cancel a booking

1. Org_admin goes to **Bookings → [booking] → Cancel**. (Agents cannot cancel confirmed bookings; this is by design, to prevent accidental cancellations.)
2. The org_admin selects a cancellation reason. The system applies the cancellation policy (see §6.5 of the architecture) and records any refund as a negative-amount `payments` row.
3. The unit's availability is freed for the cancelled dates. A cancellation email is sent to the primary contact.

### 3.8 Coordinate a cleaning

1. When a booking is `checked_out`, the system auto-creates a cleaning schedule for `check_out + 1 day`.
2. The org_admin sees upcoming cleanings in the **Operations → Cleanings** view, sorted by date and unit.
3. The org_admin can reassign cleanings, change dates, or mark them `done` after the work is complete.
4. **In v1, cleaners are not system users.** The org_admin exports a calendar (iCal feed) per cleaner, sends it to them, and updates the system when the cleaning is complete. The cleaner-via-app experience is a v1.1 feature.

### 3.9 Handle a maintenance issue

1. Org_admin or agent goes to **Maintenance → New Ticket**.
2. Selects the unit, enters a title, description, and priority. If a tenant reported the issue, the agent selects the tenant as the reporter.
3. The ticket is created in `open` state.
4. Org_admin or agent can assign it to a specific agent, change priority, add comments, and attach photos.
5. When the work is done, the org_admin or agent marks it `resolved`, with a resolution note.

### 3.10 Reset a user's password (admin-triggered)

1. Org_admin (for an agent) or super_admin (for anyone) goes to **Users → [user] → Reset Password**.
2. The system generates a strong random password, displays it once in the UI, and (if SMTP is configured and the admin ticks the box) emails it to the user.
3. **The email checkbox is hidden in the UI if SMTP is not configured** — no silent failure.
4. All the user's existing sessions are invalidated immediately. The temp password expires in 24 hours; on first login, the user is forced to set a new one.

The full flow is in [`architecture.md` §5](./architecture.md#5-auth-security-phase-5).

---

## 4. Business rules

These are the load-bearing rules the product enforces. The implementation details (DB constraints, triggers, RLS) are in the architecture doc; this section is the *contract* the product makes with its users.

### 4.1 Lease immutability

A signed lease's `monthly_rent`, `currency`, `security_deposit`, `start_date`, `end_date`, `unit_id`, and `rent_due_day` **cannot be changed**. Any change is a new lease; the previous one is `ended` or `terminated`. (See [`architecture.md` §6.5.1](./architecture.md#651-lease-lifecycle).)

**Why:** the signed lease is a legal and financial record. Allowing in-place edits would create an untraceable history and is a real-world liability for property managers.

### 4.2 No double-bookings

A unit cannot have two active leases or two confirmed bookings covering the same date. This is enforced at the **database level** using Postgres exclusion constraints — even a buggy code path cannot create an overlap. The API surfaces this as a clean 409 error with code `lease_collision` or `booking_collision`.

### 4.3 Payment application

- A payment applies to at most one lease or booking (or to nothing, for an unapplied deposit).
- Partial payments are supported; the matched invoice's `amount_paid_minor` updates automatically.
- Overpayments create an `unapplied_balance` on the lease, available to be moved to the next period.
- Refunds and voids are **negative-amount payment rows** (never edits to the original payment). The audit log records the link.

### 4.4 Invoice generation (long-term)

The nightly rollup job generates the next invoice for each `active` or `signed` lease if one doesn't exist for the current period. The job is **idempotent** — it never duplicates invoices. Proration is **out of scope for v1**: mid-month starts are billed as full months. Late fees are **out of scope for v1** — overdue status is reported, but no automatic fee is applied.

### 4.5 Pricing (short-term)

For any date D and unit U, the nightly rate is determined by:
1. The highest-priority `rate_plan` for U with a period covering D.
2. If multiple plans tie on priority, the most recently created one.
3. If no plan covers D, the unit's `is_default` plan.
4. If no default exists, the quote API returns a clean error — never zero, never invented.

### 4.6 Soft delete and retention

- **Never hard-deleted:** leases, bookings, payments, audit log entries (these are financial / legal records).
- **Soft-deleted, never hard-deleted:** users (kept for audit), units (lifetime state), contacts with open rentals.
- **Soft-deleted, hard-deleted after 30-day grace:** contacts with no open rentals, organizations with no historical data.
- **Audit log is append-only forever.** Soft-deleted records leave a tombstone in the audit log (pseudonymized for contacts).

### 4.7 Contacts are role-agnostic

A `contact` row is a person. Their role (tenant, co-tenant, guarantor, guest, payer) is determined by the **join rows** (`lease_tenants`, `booking_guests`, `payments.contact_id`), not by a column on `contacts`. The same person can be a tenant on one lease and a guest on a different booking.

### 4.8 Email-only notifications (v1)

In-app notifications are not built in v1. The only delivery channel for rent reminders, lease notices, booking confirmations, etc., is email via the configured SMTP server. The full notification matrix is in [`architecture.md` §6.5.7](./architecture.md#657-notification-matrix).

---

## 5. UI / UX requirements

The architecture doc doesn't define UI (that's not its job). This section captures the **minimum UX requirements** that the product must meet, so a designer or AI tool can generate a coherent UI without inventing things that conflict with the product behavior.

### 5.1 Required screens

| Screen | Purpose | Audience |
|---|---|---|
| Login | Email + password | All org users, super_admin (separate page) |
| Dashboard | At-a-glance: overdue invoices, today's check-ins, recent activity, upcoming cleanings | org_admin, agent |
| Units list + detail | Browse, filter, create, edit units. Sub-units nested under parents. | org_admin, agent |
| Contacts list + detail | Browse, search, create, edit contacts. View their leases and bookings. | org_admin, agent |
| Leases list + detail | Browse, filter by status/unit/tenant. Create, edit (draft only), sign, terminate. | org_admin, agent |
| Bookings list + detail | Calendar and list views. Create, confirm, check-in, check-out, cancel. | org_admin, agent |
| Payments list + detail | Browse, filter. Record new payments. | org_admin, agent |
| Invoices list + detail | Browse by lease. View status, payments applied, send manually. | org_admin, agent |
| Maintenance | List, queue, and detail of tickets. | org_admin, agent |
| Cleaning schedule | Calendar view of upcoming cleanings. | org_admin, agent |
| Documents | Per-entity document list. Upload, download, delete. | org_admin, agent |
| Reports | Default reports: overdue invoices, occupancy, payment ledger, lease roster, maintenance backlog. | org_admin, agent |
| Users | Org user management. Invite, deactivate, reset password. | org_admin |
| Settings | Org-level settings: default currency, timezone, reminder offsets. | org_admin |
| Super-admin dashboard | Cross-org view. Impersonate, suspend, view all. | super_admin |
| System settings (super-admin) | SMTP config, backup target, app name. | super_admin |

### 5.2 UX conventions

- **Time displays in the user's browser timezone**, stored in UTC. No timezone picker in v1 (we use the browser's).
- **Currency displays formatted per locale** (e.g., `$1,250.00` for USD, `1.250,00 €` for EUR), stored as integer minor units.
- **Lists are paginated and filterable** with the same controls the user has seen before (date range, status, free-text search).
- **Destructive actions** (terminate a lease, cancel a booking, delete a unit) require explicit confirmation with the entity name typed in.
- **Empty states explain the next step** ("No units yet — create your first unit to get started").
- **Loading and error states are explicit**, not silent. Network failures show a retry button.

### 5.3 Accessibility

- All interactive elements keyboard-accessible.
- All form inputs labeled.
- Color is never the only signal (e.g., overdue is red **and** has an "Overdue" badge).
- Reasonable contrast ratios (WCAG AA target; full audit is v1.1).

### 5.4 Mobile / responsive

- **Web responsive only in v1.** No native mobile app. The UI must work on tablet and phone browsers, with priority on the most common task per device (e.g., recording a payment from a phone should be one or two taps).

---

## 6. Reporting and dashboards

The reports that ship in v1 (locked in code, not customizable):

| Report | Description | Audience |
|---|---|---|
| Overdue invoices | All `invoices` with `status = overdue`, grouped by lease and contact, with days-overdue | org_admin, agent |
| Rent roll (lease roster) | All active/signed leases with tenant, unit, monthly rent, next due date | org_admin, agent |
| Payment ledger | All payments in a date range, filterable by lease/booking/contact | org_admin, agent |
| Occupancy (short-term) | Per unit, percentage of days in the date range that are booked | org_admin, agent |
| Upcoming check-ins | Confirmed bookings with `check_in` in the next 7 days | org_admin, agent |
| Upcoming check-outs | Confirmed bookings with `check_out` in the next 7 days | org_admin, agent |
| Lease expirations | Active/signed leases with `end_date` in the next 60 days | org_admin, agent |
| Maintenance backlog | Open tickets grouped by priority, with age | org_admin, agent |
| Cleaning schedule | Cleanings in the next 14 days, grouped by date | org_admin, agent |

**Custom reports, dashboards, data export, and BI integration are out of scope for v1.**

---

## 7. Compliance, retention, and data lifecycle

- **GDPR-friendly by default:** every user has a `data_export` endpoint (returns their full record as JSON) and a `delete_account` endpoint (soft-deletes the user, anonymizes PII in audit log, hard-deletes from `contacts` after a 30-day grace period).
- **PII at rest:** contact ID document numbers are encrypted via pgcrypto. Other PII (name, email, phone, address) is stored in plain text within Postgres but is protected by RLS.
- **Audit log is append-only** and retained forever (pseudonymized after a user is deleted). The super_admin UI can query the audit log by user, entity, or time range.
- **Right to be forgotten:** the `delete_account` flow anonymizes the user, their sessions, and any PII that is not a financial record. Financial records (payments, invoices) are retained in pseudonymized form because of tax / legal obligations; this is documented in the privacy policy.
- **Data residency = VM region.** Pick EU if GDPR matters; pick US otherwise. The architecture doesn't care; the data is wherever the VM is.
- **Backups are encrypted client-side** before upload to the offsite bucket. Backup retention: 30 days of daily backups, 12 monthly snapshots. Restore procedure documented in the runbook.

No formal certification (SOC 2, ISO 27001) in v1. If a customer requires it, the architecture is in good shape but the certification is a multi-month project.

---

## 8. Performance and operational targets

These are the acceptance criteria the product is built to meet. Anything not in this table is not a v1 commitment.

| Metric | Target |
|---|---|
| Concurrent users supported | 250 baseline, 2,500 headroom |
| `/api/health` (p95) | < 100ms |
| `/api/v1/units/:id/availability` (p95) | < 300ms |
| `/api/v1/bookings` POST (p95) | < 500ms |
| `/api/v1/auth/login` (p95) | < 800ms |
| `/api/v1/payments` POST (p95) | < 400ms |
| Uptime | 99.5% (~3.6h downtime/month) |
| RPO (max data loss on disaster) | 1 hour |
| RTO (time to restore from backup) | 4 hours |
| Backup window (full pg_dump) | < 30 minutes |
| Tenant data isolation | Database-enforced (RLS) |

The implementation details (what makes these targets achievable) are in the architecture doc.

---

## 9. Open product questions

Items that the product team should decide before or during build. These don't block architecture, but they do block specific features.

| Question | Affects |
|---|---|
| Cancellation policy: full refund / partial / none, by how-many-days-out? | Booking cancellation flow, payment refund automation |
| Default rent-due day: 1st of month, or configurable per lease? | Lease form, invoice generation |
| Grace period for overdue invoices: 5 days, configurable per org, or per lease? | Invoice overdue transition, late fee policy |
| Late fees: flat, percentage, none? | Invoice generation (if v1.1) |
| Security deposit handling: separate `payments` row, or built-in deposit ledger? | `payments` schema, deposit return flow |
| Cleaning notification: in-app, SMS, or both? | Cleaning schedule workflow (v1.1) |
| Org-level default currency: chosen at signup, or per-org setting? | `system_settings` schema (currently global) |
| Multi-org users (one person, multiple orgs): supported in v1, or single-org only? | `users` schema (currently single-org) |
| Booking channel pricing overrides (Airbnb commission, direct discount): in v1? | `bookings` schema, channel reporting |
| Sub-unit availability rules inheritance from parent: in v1? | `unit_availability_rules` schema |

For each of these, the default position is: **defer to v1.1 with a sensible global default in v1.** A v1 customer can survive without per-tenant configurability of cancellation policy; they can't survive without cancellation policy working at all.

---

## 10. Roadmap signals (v1.1 and beyond)

Items that are explicitly **not in v1** but are likely **v1.1 or v2** candidates. These are listed so the build doesn't paint us into a corner.

**v1.1 candidates (within ~3 months of v1 launch):**
- 2FA for `org_admin` and `super_admin`
- Per-tenant email template customization
- Cleaning staff as system users (limited role)
- E-signature integration for leases
- In-app notifications
- Document versioning
- Custom report builder (basic)

**v2 candidates (within ~6–12 months):**
- Tenant portal (renters log in to see their lease, payments, maintenance)
- Owner portal (owners see statements, occupancy, performance)
- Channel manager sync (Airbnb, Booking.com)
- Payments processor integration
- Multi-currency within a single org
- Mobile app
- ABAC for fine-grained permissions
- SOC 2 certification

The architecture is designed to make v1.1 changes additive (the architecture doc's "v2 is additive in code structure" promise applies here too — a new role can be added without breaking existing permissions).

---

## 11. Cross-references

- **Architecture Document:** [`architecture.md`](./architecture.md). The home for *how* the system is built. The product behavior contracts in that doc's **§6.5** are the source of truth for state transitions, side effects, and the notification matrix.
- **What this is not:** the full deferral list is in [`architecture.md` §8](./architecture.md#8-what-this-is-not-expanded).
- **Auth and security behavior:** [`architecture.md` §5](./architecture.md#5-auth-security-phase-5).

When the two documents appear to disagree, the architecture doc's §6.5 takes precedence on **how the behavior is implemented**; this PRD takes precedence on **what the behavior is**. The two should be updated together when a load-bearing product behavior changes.

---

**End of document.**
