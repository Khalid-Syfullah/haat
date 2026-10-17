# Tuktak Bazaar — single-vendor e-commerce for Bangladesh

A complete online store with shopping features, built for one seller:
flash sales, collectible vouchers, coins, photo reviews, product Q&A, returns,
cash on delivery with refusal-risk scoring, bKash / Nagad / card payments through
SSLCommerz, Bangla and Banglish search, and an admin panel that runs it all.

"Haat" (হাট) is a placeholder brand. Change it in **Admin → Settings → Store name**
(and the wordmark in `apps/web/components/store/logo.tsx`).

## Stack

| Part | Tech |
| --- | --- |
| API | NestJS 11, Prisma 6, PostgreSQL 16 (with `pg_trgm` for fuzzy search) |
| Web | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Jobs | `@nestjs/schedule` inside the API (unpaid-order expiry, payment reconciliation) |
| Tests | `apps/api/test/e2e.ts` — 45 checks over checkout, payments, stock races, returns |

```
haat/
├─ apps/api        NestJS API  (port 4000, everything under /api)
│  ├─ prisma/      schema, migration, seed data and generated demo images
│  ├─ src/         feature folders: auth, catalog, cart, checkout, orders, payments, aftersale, admin …
│  └─ test/e2e.ts  end-to-end checks against a running API
├─ apps/web        Next.js storefront + /admin panel (port 3000)
│  ├─ app/(store)  shopper pages
│  ├─ app/admin    staff pages
│  └─ components/  ui kit, store and admin components
└─ docker-compose.yml
```

## Run it locally

Requirements: Node 20.9+ (22 recommended) and Docker (for Postgres), or your own Postgres 16.

```bash
npm install
npm run db:up                          # Postgres in Docker on :5432
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm run setup                          # apply migrations + load demo data
npm run dev                            # API on :4000, web on :3000
```

Open http://localhost:3000.

| Who | Login | Password |
| --- | --- | --- |
| Customer (has orders, coins, vouchers) | `01711111111` | `customer123` |
| Admin (open `/admin`) | `admin@haat.local` or `01700000000` | `admin1234` |

SMS login codes are printed in the API log and shown on screen while `SMS_PROVIDER=console`.
Online payments go to a built-in test page while `PAYMENT_PROVIDER=mock`.

`npm run db:seed` wipes and reloads the demo store at any time.

## Checks

```bash
npm run typecheck
npm run test:e2e        # needs the API running on :4000 and seeded data
```

GitHub Actions (`.github/workflows/ci.yml`) runs migrations, seed, type-checks,
the end-to-end checks and both production builds on every push.

## Going live

1. **Payments** — create an SSLCommerz store (sandbox first) and set in `apps/api/.env`:
   `PAYMENT_PROVIDER=sslcommerz`, `SSLCZ_STORE_ID`, `SSLCZ_STORE_PASSWORD`, `SSLCZ_SANDBOX=true`.
   `API_PUBLIC_URL` must be reachable from the internet so SSLCommerz can post IPN callbacks.
   The client in `apps/api/src/payments/sslcommerz.client.ts` follows the v4 hosted-page API
   but has not been run against a live sandbox yet — do a test payment before launch.
2. **SMS** — plug a provider into `otpRequest` in `apps/api/src/auth/auth.controller.ts`.
3. **Secrets** — set a long random `JWT_SECRET` and `COOKIE_SECURE=true` behind HTTPS.
4. **Images** — uploads go to `UPLOAD_DIR` on disk; mount a volume or switch the storage
   engine in `apps/api/src/uploads/uploads.controller.ts` to S3.
5. **Jobs** — scheduled jobs run inside the API; if you run several API instances, set
   `DISABLE_JOBS=true` on all but one.
6. **Compliance** — trade licence, DBID registration, and the current Digital Commerce
   Operation Guidelines (delivery and refund timelines). Return windows, fees and COD
   rules are all in Admin → Settings.

### Docker

```bash
docker compose --profile app up -d --build
docker compose exec api npm run db:seed
```

### A single server (e.g. EC2 + nginx)

Build with `npm run build`, run `npm run start` under a process manager (pm2 or systemd),
and proxy your domain to port 3000. Only `/api/payments/sslcommerz/*` needs to reach the
API directly (set `API_PUBLIC_URL` to a public URL that forwards to port 4000), everything
else goes through the Next.js app. A t4g.small is fine for staging; for production use a
managed Postgres (RDS) and give the API and web their own containers.

## How the important parts work

- **Stock never oversells.** Checkout takes stock with one conditional
  `UPDATE … WHERE stock >= qty` per line inside the order transaction, plus a database
  check constraint. Flash-sale caps and voucher limits use the same pattern.
- **Orders follow one state machine** (`apps/api/src/orders/order-workflow.service.ts`).
  Every transition is validated, logged as a timeline event and sent to the customer.
  Cancelling or a failed delivery returns stock, flash-sale quota, voucher use and coins.
- **COD risk score** (0–100) from the phone number's history decides whether an order
  confirms itself, waits for a call, or needs online payment. Thresholds are in settings.
- **Payments are idempotent.** An order is marked paid only once even if the gateway
  callback, the IPN and the reconciliation job all arrive.
- **Search** expands each word through a synonym table (Bangla ⇄ Banglish ⇄ English),
  matches Latin words at word starts, and uses trigram similarity for typos.
