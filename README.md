# KFC Conversational Ordering

Database foundation for the Vietnamese conversational ordering MVP described in
`plan.md`. The repository uses PostgreSQL 16 in Docker and Prisma ORM with a
TypeScript seed pipeline.

## Prerequisites

- Docker with Docker Compose
- Node.js 22+
- npm

## Local setup

```bash
cp src/backend/.env.example src/backend/.env
npm --prefix src/backend install
make -C src/backend db-up
make -C src/backend db-migrate-dev
make -C src/backend db-seed
```

The seed is idempotent and imports all 8 categories and 94 menu items from
`assets/data/kfc_catalog.json`. It also creates demo modifiers, users with
required email and phone fields, addresses, OTP state, loyalty, voucher cases,
and an order for operations metrics.

## Commands

- `npm --prefix src/frontend-mobile install` — install Expo mobile dependencies.
- `npm --prefix src/frontend-mobile start` — start the Expo development server.
- `make -C src/backend db-up` — start PostgreSQL.
- `make -C src/backend db-down` — stop services and retain the database volume.
- `make -C src/backend db-migrate` — deploy committed Prisma migrations.
- `make -C src/backend db-migrate-dev` — create/apply development migrations.
- `make -C src/backend db-seed` — run the idempotent demo seed.
- `make -C src/backend db-reset` — reset, migrate, and seed the local database.
- `make -C src/backend test` — run the backend automated tests.
- `make -C src/backend lint` — run TypeScript and Prisma schema checks.
- `make -C src/backend run` — start required local infrastructure.

## Layout

- `src/backend/` — self-contained backend package and database toolchain.
- `src/frontend-mobile/` — React Native/Expo Messenger chat-list module.
- `src/frontend-mobile/pages/MessengerChatModule.tsx` — mobile module entry point and list/detail navigation.
- `src/frontend-mobile/theme.ts` — shared mobile design tokens.
- `src/backend/prisma/schema.prisma` — relational schema and constraints.
- `src/backend/prisma/seed.ts` — catalog and deterministic demo data.
- `src/backend/src/lib/normalization.ts` — canonical email and phone handling.
- `src/backend/tests/` — backend automated checks.
- `assets/data/kfc_catalog.json` — source catalog snapshot.

## Data rules

- Registered users require unique email and normalized phone values; email is
  trimmed and lowercased before every user lookup or write.
- Prices and discounts are integer VND amounts.
- OTP values are represented by hashes only; logs and transcripts store redacted
  content.
- Quotes and orders contain immutable price, voucher, item, email, phone, and
  delivery snapshots.
- The AI ordering flow does not expose or persist carts. It creates an
  `OrderQuote` directly from catalog item and modifier IDs, asks the customer
  to confirm the quote, then creates one immutable order from that quote.
- Unique event, quote, and idempotency keys prevent duplicate webhook processing
  and duplicate orders.
- Business services must validate voucher eligibility and confirmation tokens
  before writing orders.

## Order API

All routes require `Authorization: Bearer <access_token>`.

- `POST /api/order-quotes` creates a 15-minute quote from a conversation
  session, catalog item IDs, modifier IDs, quantities, and delivery details.
- `POST /api/orders` consumes `{ quote_id, confirmation_token }` and requires
  an `Idempotency-Key` header.
- `GET /api/orders` lists the current user's orders; `GET /api/orders/{id}`
  returns immutable snapshots and status history.
- `PATCH /api/orders/{id}/delivery` updates delivery while status is `CREATED`.
- `DELETE /api/orders/{id}` cancels an order in `CREATED` or `CONFIRMED`.
