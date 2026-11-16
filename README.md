# WebCafe

Bahasa Indonesia version: [readme.id.md](readme.id.md)

A cafe operating system: **one backend, three frontends**. Open source, self-hosted, **no Docker**. Designed to run on a 1 vCPU / 1GB RAM VPS.

| App | Access | For |
|---|---|---|
| **Customer Menu** | public, `/` | customers scan the QR on the table → order without login, without installing anything |
| **Cashier / POS** | login, `/kasir` | manual input, mark as paid, print receipts, manage menu & tables |
| **Kitchen Display** | login, `/kds` | real-time kitchen queue, FIFO, per-order timer |

Real-time via WebSocket (Socket.io) — **not** polling. Prices are stored as integer rupiah, no floats.

## Status

This repo is still being built in stages. What already works and is verified:

- ✅ **Foundation** — pnpm monorepo, `@cafe/shared`, Prisma schema + migrations + seed
- ✅ **Backend core** — 7 modules (auth, menu, order, kitchen, table, report, settings), Socket.io, 26 tests passing
- ✅ **Customer Menu** — QR resolving, catalogue + real-time Sold Out badge, cart, checkout, status page. 117KB gzip bundle
- ✅ **Cashier** — login + role guard, live active orders + sound, details + timeline, payment & change, manual cashier, 58/80mm receipts, menu CRUD + photos + sold-out toggle, table CRUD + QR printing. 128KB gzip bundle
- ✅ **Kitchen Display** — 3 columns, large cards + background notes, timer & ageing colours, new-order sound, one-tap actions, connection indicator, wake lock. 114KB gzip bundle
- ✅ **Reports & admin** — summary cards, range presets, SVG revenue chart, best-selling menu, payment methods, CSV export, user management, settings
- ✅ **Deployment** — `Caddyfile`, `ecosystem.config.cjs`, `scripts/backup.sh` (restore already tested against a separate DB), security checklist
- 🚧 **Clean VPS test** — not done yet; needs a server

48 tests passing (14 api + 12 shared + 15 kasir + 7 kds). Receipt printing has only been tested via print preview, not yet on a physical thermal printer.

Work order & *definition of done* per phase: [docs/roadmap.md](./docs/roadmap.md).

## Features

**Digital menu** — ordered categories, photos (auto-resized to `.webp`), sold-out/available toggle whose effect appears real-time in all open apps.

**Customer orders** — scan QR → table detected from the token. Cart with per-item notes. Checkout without an account. **Totals are computed on the server**, prices taken from the DB, never from the request body. An item that becomes sold out mid-checkout → 409 with the item's name.

**Status tracking** — `baru` → `dikonfirmasi` → `diproses` → `selesai` → `diambil` (plus `dibatalkan`). Customers see changes without refreshing; the status page can be reopened via the order code.

**Cashier** — manual walk-in/takeaway orders, live active order list, `cash` payment (change calculation) / `transfer` / `qris_manual`, receipt printing via `window.print()` + CSS `@media print` (thermal 58/80mm).

**Tables & QR** — table CRUD, generate QR per table (print-ready PNG/SVG), regenerate token (old QR dies immediately).

**Reports** — revenue per date range (presets Today / 7 days / This month / Last month / custom), daily-weekly-monthly bar charts, best-selling menu, breakdown per payment method, CSV export. All reports only count **paid** orders at payment time: an order created at 23.50 and paid at 00.10 counts towards the payment day's revenue.

**Admin** — user management (create, change role, activate/deactivate, reset password) with last-active-admin protection, and settings for tax/service/receipt footer/auto-confirm.

Phase 2 (not yet): ingredient stock, multi-outlet (`outletId` already prepared in all operational tables), automatic QRIS via webhook.

## Stack

| Layer | Choice | Brief reason |
|---|---|---|
| Runtime | Node.js 22 LTS | `sharp` is mature, PM2 first-class |
| HTTP | Fastify 5 | ~2× Express throughput, complete official plugin set |
| Realtime | Socket.io 4 | built-in rooms, auto-reconnect, fallback for bad phones/proxies |
| ORM | Prisma 6 | versioned migrations, generated types |
| Database | MariaDB 11 (InnoDB, `utf8mb4`) | abundant tooling, mature backup & replication |
| Frontend | React 19 + Vite + TypeScript + Tailwind 4 | three separate apps, identical stack |
| Validation | Zod on all boundaries | one schema used by server & client |
| Auth | `@fastify/jwt` + `argon2id` | stateless, no Redis |
| Deploy | PM2 + Caddy | native, automatic TLS, no containers |

Modular monolith — not microservices. Each backend module has separate `routes` / `service` / `repository`, and other modules may only enter through `service`.

## Structure

```
apps/
  api/                 # Fastify — the only Node process
    prisma/            # schema.prisma + migrations (committed)
    src/modules/       # auth · menu · order · kitchen · table · report · settings
  customer-menu/       # public  → /
  kasir/               # staff   → /kasir
  kitchen-display/     # staff   → /kds
packages/
  shared/              # @cafe/shared — Zod schemas, types, money.ts, events.ts
docs/                  # prd · arsitektur · database · api · roadmap · agent
```

`apps/*` may use `packages/*`. Not the other way round. `apps/*` may not import each other — the cross-app contract is only via `@cafe/shared`.

## Running Locally

Requires **Node ≥ 22**, **pnpm 11**, and **MariaDB 11** running on `localhost:3306`.

```bash
# 1. Database
mysql -u root -proot -e "CREATE DATABASE webcafe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Configuration
cp .env.example .env
# then fill in JWT_SECRET in .env:  openssl rand -hex 32

# 3. Dependencies + schema + initial data
pnpm install
pnpm db:migrate
pnpm db:seed          # creates the admin user — password printed once to stdout

# 4. Run
pnpm dev
```

| Address | App |
|---|---|
| http://localhost:5173 | Customer Menu |
| http://localhost:5174 | Kasir |
| http://localhost:5175 | Kitchen Display |
| http://localhost:3000/api/health | API — replies `{"status":"ok","db":"ok","uptime":N}` |

Vite proxies `/api`, `/uploads`, and `/socket.io` to `:3000`, so there are no CORS issues in dev or production.

### Commands

```bash
pnpm dev          # all apps in parallel
pnpm build        # build shared → api → 3 frontends
pnpm test         # vitest
pnpm typecheck    # tsc --noEmit in all packages

pnpm db:migrate   # dev  — prisma migrate dev (creates new migration files)
pnpm db:deploy    # prod — prisma migrate deploy (no prompt, no reset)
pnpm db:studio    # Prisma Studio GUI :5555
pnpm db:seed      # initial data, idempotent
```

> **Do not** run `pnpm db:migrate` in production. `migrate dev` may offer a database reset when it detects drift — on the server that means all order data is lost. Use `pnpm db:deploy`.

## Deploying to a VPS

In short: 2GB swap first, tune `my.cnf`, `pnpm build`, `pm2 start`, Caddy as TLS + router. Full steps with the reasoning behind each number are in [docs/arsitektur.md](./docs/arsitektur.md#deployment-tanpa-docker) — including the `my.cnf`, `ecosystem.config.cjs`, `Caddyfile` files, update procedure, and backup.

Things to remember:

- **2GB swap before anything else.** MariaDB on 1GB RAM without swap is prone to OOM-kill.
- **`build-essential` is required.** Without Docker, `sharp` is compiled on the machine itself.
- **Non-root DB user** + `bind-address = 127.0.0.1`. `root:root` in `.env.example` is only for local dev.
- **`instances: 1` in PM2.** Socket.io multi-process needs a Redis adapter; without it, new orders only reach clients that happen to be connected to the same process.
- **`trustProxy: true` in Fastify** (already set). Without it, behind Caddy all requests look like they come from `127.0.0.1` and one customer consumes the rate limit quota for everyone.

Run the [security checklist](./docs/keamanan.md) before the system faces the internet.

### Backup

```bash
# test first
BACKUP_DIR=/tmp/uji-backup ./scripts/backup.sh

# daily cron 02.15
15 2 * * * /var/www/web-cafe/scripts/backup.sh >> /var/log/webcafe-backup.log 2>&1
```

Dumps are validated (size + `gzip -t`) before rotation, so a broken backup does not delete old backups. The restore procedure is commented below `scripts/backup.sh` — **test the restore once** before relying on it, and keep a copy outside the VPS.

## Documentation

| Document | Contents |
|---|---|
| [prd.md](./docs/prd.md) | problem, target users, MVP vs nice-to-have features, NFRs, constraints, metrics |
| [arsitektur.md](./docs/arsitektur.md) | principles, diagrams, tech stack + reasons, real-time flow, deployment |
| [database.md](./docs/database.md) | tables, columns, relations, indexes, portability notes |
| [api.md](./docs/api.md) | REST endpoints per module, socket events + rooms/payloads, response format, rate limits |
| [roadmap.md](./docs/roadmap.md) | build phases in order + *definition of done* |
| [keamanan.md](./docs/keamanan.md) | pre-launch checklist: public routes, role limits, uploads, rate limits + VPS items that must be checked |
| [agent.md](./docs/agent.md) | repo rules for AI agents continuing work here |

## Contributing

Rules enforced in this repo:

- Package manager **pnpm**. Don't mix lockfiles.
- Money is always full `Int` rupiah, all arithmetic via `@cafe/shared/money`. `parseFloat`/`Decimal` on the money path is **forbidden**.
- Zod validation on all boundaries, schemas in `packages/shared/src/schemas.ts`.
- Emit Socket.io events **after** the transaction commits, not inside it.
- Layer boundaries: `routes` → `service` → `repository`. Routes do not call the repository.
- `any` is forbidden in new code.
- No Docker — `Dockerfile`/`docker-compose.yml` will not be merged.
- `pnpm typecheck`, `pnpm build`, `pnpm test` must pass before a PR.

## License

[MIT](./LICENSE)
