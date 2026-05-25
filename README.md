# Nivo SaaS POS

Modern SaaS POS system for shoe stores (zapaterias) -- multi-tenant, offline-first, with e-commerce storefront and mobile app.

## Tech Stack

- **Backend:** NestJS, TypeORM, PostgreSQL, Redis, BullMQ, Stripe
- **POS Admin:** Next.js 14 (App Router), Shadcn/ui, Zustand, Dexie.js
- **Storefront:** Next.js 14 (SSR, SEO, Stripe Elements)
- **Mobile:** React Native / Expo
- **Monorepo:** Turborepo + pnpm workspaces

## Architecture

- **Multi-tenant:** Database-per-tenant with isolated PostgreSQL databases
- **Offline-first POS:** Sales stored in IndexedDB, synced when online
- **Async jobs:** BullMQ workers for provisioning, reports, alerts
- **Auth:** JWT with role-based guards (super-admin, admin, manager, cashier)

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker (for PostgreSQL and Redis)

### Setup

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker compose up -d

# Copy and configure environment variables
cp .env.example .env

# Start all apps in development mode
pnpm dev
```

### Individual Apps

```bash
pnpm dev --filter=api           # API         → http://localhost:3000
pnpm dev --filter=pos-admin     # POS Admin   → http://localhost:3001
pnpm dev --filter=storefront    # Storefront  → http://localhost:3002
```

## Project Structure

```
nivo-monorepo/
├── apps/
│   ├── api/              # NestJS backend
│   ├── pos-admin/        # Next.js admin + POS
│   ├── storefront/       # Next.js e-commerce
│   └── mobile/           # React Native / Expo
├── packages/
│   ├── database/         # TypeORM entities & migrations
│   ├── types/            # Shared TypeScript interfaces
│   ├── ui/               # Shared UI components
│   └── eslint-config/    # Shared ESLint rules
├── scripts/              # Simulators & utilities
├── docker-compose.yml
└── turbo.json
```

## Scripts

```bash
pnpm build        # Build all packages and apps
pnpm lint         # Lint entire monorepo
pnpm typecheck    # TypeScript type checking
```

## License

Private -- All rights reserved.
