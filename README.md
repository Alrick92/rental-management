# Rental Management SaaS

Multi-tenant rental management platform for property managers handling both long-term leases and short-term bookings.

## Quick Start (Development)

```bash
# 1. Start the database
docker compose -f docker-compose.dev.yml up -d

# 2. Copy environment file
cp .env.example .env
# Edit .env — set DATABASE_URL to: postgresql://rental:rental_dev_password@localhost:5432/rental_management

# 3. Install dependencies
pnpm install

# 4. Generate Prisma client + run migrations
pnpm db:generate
pnpm db:migrate

# 5. Seed the database
pnpm db:seed

# 6. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@rental.local` | `admin123!secure` |
| Org Admin | `manager@demo-properties.com` | `manager123!secure` |
| Agent | `agent@demo-properties.com` | `agent123!secure` |

- **Org login:** [http://localhost:3000/login](http://localhost:3000/login)
- **Admin login:** [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## Production Deployment (VPS)

```bash
# 1. Clone the repo
git clone <repo-url> rental-management
cd rental-management

# 2. Create .env from example
cp .env.example .env
# Edit .env with your production values:
#   - Strong passwords for POSTGRES_PASSWORD, SESSION_COOKIE_SECRET, SETTINGS_ENCRYPTION_KEY
#   - Set DOMAIN to your domain name
#   - Generate secrets: openssl rand -hex 32

# 3. Deploy
docker compose up -d

# 4. Run migrations
docker compose exec app npx prisma migrate deploy

# 5. Seed the super admin
docker compose exec app npx tsx prisma/seed/index.ts
```

Caddy handles TLS automatically via Let's Encrypt. Set `DOMAIN` in `.env` to your domain.

## Architecture

- **Next.js 16** (App Router, TypeScript) — web UI + REST API
- **PostgreSQL 16** — data + RLS for multi-tenant isolation
- **Prisma** — ORM + migrations
- **pg-boss** — background job queue (worker process)
- **Caddy** — reverse proxy, auto-TLS
- **Docker Compose** — single `docker compose up` deployment

See `architecture.md` and `product-requirements.md` for full specs.

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── api/
│   │   ├── health/       # Health check endpoint
│   │   └── v1/           # REST API v1
│   │       ├── auth/     # Login, logout, session
│   │       └── admin/    # Super-admin endpoints
│   ├── admin/            # Super-admin UI
│   ├── dashboard/        # Org dashboard
│   └── login/            # Org login page
├── lib/                  # Shared utilities
│   ├── db.ts             # Prisma client + withOrgContext (RLS)
│   ├── auth.ts           # Session management
│   ├── password.ts       # Argon2id hashing
│   ├── api-utils.ts      # Error responses, rate limiting
│   ├── audit.ts          # Audit log writer
│   └── validators.ts     # Zod schemas
└── proxy.ts              # Next.js proxy (auth redirects)
prisma/
├── schema.prisma         # Full database schema
├── init.sql              # PostgreSQL extensions setup
└── seed/                 # Database seeder
```
