# Phase 3 — Enhanced Features Plan

## Scope (from PRD §8)
**Theme:** Reservation calendar, messaging hub, notifications/reminders, announcements, analytics

### Features by component

**1. Messaging Hub** (all roles)
- Schema: Add `ThreadParticipant` join table (`thread_id`, `user_id`, `last_read_at`) to MessageThread
- API: `POST/GET /api/v1/messages/threads` (create thread, list threads)
- API: `POST/GET /api/v1/messages/threads/[id]/messages` (send message, get messages)
- UI: `/dashboard/messages` (manager), `/tenant/messages`, `/landlord/messages`
- Participants scoped: tenant→PM, landlord→PM, PM↔anyone in org

**2. Announcements** (managers publish, tenants/landlords receive)
- Schema: Already have `Announcement` model with `scope: org|property|contact`
- API: `POST/GET/PATCH /api/v1/announcements` (CRUD + publish)
- UI: `/dashboard/announcements` (create/edit/publish)
- UI: Tenant portal shows announcements on dashboard + `/tenant/announcements`
- UI: Landlord portal shows property-scoped announcements

**3. Reservation Calendar** (managers)
- API: `GET /api/v1/calendar` — returns bookings + lease occupancy as timeline events for a date range
- UI: `/dashboard/calendar` — month-view grid showing unit occupancy
- Color-coded: bookings (blue/green/red by status), leases (purple)

**4. Analytics Dashboard** (managers)
- API: `GET /api/v1/analytics/dashboard` — occupancy trends, revenue trends, maintenance stats, upcoming events
- UI: `/dashboard` — replace empty page with summary cards + mini charts
  - Occupancy rate (current + 30-day trend)
  - Revenue this month vs last month
  - Open maintenance tickets
  - Upcoming check-ins/outs
  - Recent payments needing approval
  - Overdue invoices count

**5. Tenant Dashboard Enhancement**
- Show announcements, upcoming payment due, open maintenance requests on tenant home page

### What's NOT in Phase 3
- Email/SMS notifications (PRD says "v1 delivery is email only via SMTP server; in-app/SMS are Phase 3+" but no SMTP is configured — we'll build in-app notification UI and leave email hooks as TODO)
- Property-type-specific fields (deferred — low priority, schema extension only)

### Implementation order
1. Schema migration (ThreadParticipant)
2. Messaging API + UI
3. Announcements API + UI
4. Calendar API + UI
5. Analytics dashboard API + UI
6. Tenant/landlord dashboard enhancements
