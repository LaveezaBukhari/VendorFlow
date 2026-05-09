# VendorFlow

Enterprise B2B procurement management SaaS platform for managing vendors, purchase orders, inventory, and approval workflows with full audit trails.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 / 8080)
- `pnpm --filter @workspace/vendorflow run dev` — run the frontend (auto-assigned port)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed the database with demo data
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + helmet + express-rate-limit + pino logging
- Auth: JWT (access 15min + refresh 7d tokens) + bcryptjs + RBAC
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod
- API codegen: Orval (from OpenAPI spec)
- Frontend: React 19 + Vite + Tailwind + shadcn/ui + TanStack Query + wouter

## Where things live

- `lib/db/src/schema/` — Drizzle table definitions (source of truth for DB schema)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/src/generated/` — Generated hooks and Zod schemas (do not edit)
- `lib/api-client-react/src/custom-fetch.ts` — Bearer token injection via `setAuthTokenGetter`
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middleware/auth.ts` — JWT authenticate + RBAC authorize middleware
- `artifacts/api-server/src/lib/jwt.ts` — signAccessToken, signRefreshToken, verify functions
- `artifacts/api-server/src/lib/audit.ts` — writeAudit helper (immutable audit log writer)
- `artifacts/vendorflow/src/contexts/auth-context.tsx` — JWT token storage + setAuthTokenGetter registration
- `artifacts/vendorflow/src/pages/` — All frontend pages

## Architecture decisions

- JWT access tokens (15min) + refresh tokens (7d) stored in localStorage; tokens auto-injected via `setAuthTokenGetter` in the custom fetch wrapper
- Multi-tenant architecture: every DB query is scoped to `tenantId` from JWT payload; no cross-tenant data leakage
- RBAC via `authorize(...roles)` middleware — 7 roles: super_admin, company_admin, procurement_officer, finance_officer, inventory_manager, auditor, read_only_viewer
- Immutable audit logs: every write operation calls `writeAudit()` capturing before/after values, correlation ID, IP address, and user identity — audit failures never bubble up to break business logic
- API returns arrays (not paginated wrappers) for list endpoints to stay compatible with generated TanStack Query hooks; filtering is done server-side

## Product

- **Dashboard**: KPI cards (total vendors, active orders, pending approvals, total spending, inventory value, low stock count) + bar chart of spending by vendor + donut chart of orders by status + live low-stock alerts
- **Vendors**: Full CRUD with category, rating, risk score, blacklist, compliance expiry tracking
- **Procurement**: Purchase order lifecycle (draft → submitted → approved/rejected → received), line-item detail, multi-stage approval history
- **Inventory**: SKU-level stock tracking with warehouse locations, reorder alerts, movement log (received/issued/adjusted/reserved)
- **Audit Logs**: Immutable tamper-proof log of all entity changes with before/after values
- **Notifications**: Real-time bell icon with unread count; PO status changes auto-generate notifications
- **Settings**: Profile and organization info

## User preferences

- Use `zod` (not `zod/v4`) in all server-side code
- API routes return plain arrays for list endpoints (not paginated wrappers) to be compatible with generated hooks
- Never use `console.log` in server code — use `req.log` in handlers, `logger` singleton elsewhere

## Gotchas

- API server must be rebuilt when routes change (`restart_workflow` triggers the build)
- The `pnpm-workspace.yaml` catalog must include any new shared dependencies before using `catalog:` in package.json
- `@workspace/db` exports from barrel `lib/db/src/index.ts` — add new tables there after creating schema files
- Seeding is idempotent (uses `.onConflictDoNothing()`) — safe to run multiple times

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Demo credentials: john@acme.com / password
