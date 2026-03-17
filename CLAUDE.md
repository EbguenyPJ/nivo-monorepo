# Nivo SaaS POS - Monorepo

## Project Overview
Nivo is a modern SaaS POS system for shoe stores (zapaterías) with multi-tenant architecture (database-per-tenant), offline-first POS, e-commerce storefront, and mobile app.

## Tech Stack
- **Monorepo:** Turborepo + pnpm workspaces
- **Backend:** NestJS (apps/api) — TypeORM, PostgreSQL, Redis, BullMQ, Socket.io, Stripe
- **POS Admin:** Next.js 14 App Router (apps/pos-admin) — Shadcn/ui, Zustand, Dexie.js (offline)
- **Storefront:** Next.js 14 App Router (apps/storefront) — SSR, SEO, Stripe Elements
- **Mobile:** React Native / Expo (apps/mobile) — Expo Router, camera/barcode scanning
- **Shared Packages:** @nivo/database, @nivo/types, @nivo/ui, @nivo/eslint-config

## Architecture
- **Multi-Tenant:** Database-per-tenant. Master DB (nivo_master_db) manages tenants/subscriptions. Each tenant gets an isolated PostgreSQL database.
- **Tenant Resolution:** Middleware extracts subdomain → queries master DB → creates dynamic TypeORM connection.
- **Offline-First POS:** Sales stored in IndexedDB (Dexie.js) with UUID keys. Synced via POST /api/v1/sales/sync when online.
- **Async Jobs:** BullMQ workers for tenant provisioning, report generation, low stock alerts.

## Commands
```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start all apps in dev mode
pnpm dev --filter=api     # Start only the API (port 3000)
pnpm dev --filter=pos-admin  # Start POS Admin (port 3001)
pnpm dev --filter=storefront # Start Storefront (port 3002)
pnpm build                # Build all packages and apps
pnpm lint                 # Lint entire monorepo
pnpm typecheck            # TypeScript type checking
docker compose up -d      # Start Postgres + Redis
docker compose down       # Stop infrastructure
```

## Directory Structure
```
nivo-monorepo/
├── apps/
│   ├── api/           # NestJS backend (port 3000)
│   ├── pos-admin/     # Next.js admin + POS (port 3001)
│   ├── storefront/    # Next.js e-commerce (port 3002)
│   └── mobile/        # React Native / Expo
├── packages/
│   ├── database/      # TypeORM entities & migrations
│   ├── types/         # Shared TypeScript interfaces, DTOs, enums
│   ├── ui/            # Shadcn/ui components + Tailwind config
│   └── eslint-config/ # Shared ESLint rules
├── docker-compose.yml
└── turbo.json
```

## API Structure
- **Master API** (/api/v1/): auth, tenants, subscriptions, webhooks/stripe
- **Tenant API** (/api/v1/): products, inventory, pos, sales, employees, customers, reports, chat (WebSocket)

## Key Patterns
- All IDs are UUIDs (for offline sync compatibility)
- Soft deletes enabled on products (deleted_at column)
- JWT auth with role-based guards (super-admin, admin, manager, cashier)
- Employee PIN code login for fast POS access
- TypeORM entities in packages/database (shared between API and migrations)

## Environment Variables
Copy `.env.example` to `.env` and configure. Key variables:
- `MASTER_DB_*` — PostgreSQL master connection
- `REDIS_HOST/PORT` — Redis for BullMQ and WebSockets
- `JWT_SECRET` — Token signing
- `STRIPE_SECRET_KEY` — Stripe test mode key
