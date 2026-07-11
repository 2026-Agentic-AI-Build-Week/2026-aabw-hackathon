# KFC Conversational Ordering

Full-stack hackathon workspace for a KFC conversational-ordering MVP. The
repository contains a PostgreSQL/Prisma backend for authentication, menu lookup,
order quotes, stock-aware order creation, and order management, plus an Expo
React Native mobile app with Messenger-inspired login and chat flows.

## Current Scope

| Area | Current implementation |
| --- | --- |
| Authentication | Email/password login, token refresh, logout, profile lookup, and Expo SecureStore session persistence. |
| Menu | Authenticated lookup of candidate menu item IDs, including unavailable and missing item classification. |
| Orders | Quote creation, idempotent order creation, delivery updates, cancellation, pagination, and order-status filtering. |
| Inventory | Available stock is seeded and checked before order creation; stock is decremented atomically. |
| Mobile | Expo login flow, searchable Messenger-style chat list, and authenticated realtime KFC Bot conversation. |
| Realtime chat | Socket.IO text chat persists a per-user session and uses OpenAI menu assistance when configured; a deterministic demo fallback is used without an AI key in development. |

## Prerequisites

- Node.js 22+ and npm
- Docker Engine with Docker Compose
- For mobile: Expo Go on a physical device, or an Android emulator / iOS Simulator

## Quick Start

Run the backend and mobile app in separate terminals from the repository root.

### 1. Configure and start PostgreSQL

```bash
cp src/backend/.env.example src/backend/.env
npm --prefix src/backend install
docker compose --env-file src/backend/.env -f src/backend/docker-compose.yml up -d
```

### 2. Prepare the backend database

```bash
npm --prefix src/backend run db:generate
npm --prefix src/backend run db:migrate
npm --prefix src/backend run db:seed
```

The seed is idempotent. It imports the catalog and demo business data, then
creates active and blocked test users.

### 3. Run the backend API

```bash
npm --prefix src/backend run dev
```

The development API listens on port `3000`. `HOST=0.0.0.0` in the backend env
allows Android/iOS devices on the local network to reach it. If port `3000` is
already occupied, stop the process using it or choose another `PORT` and update
the mobile API base URL to match.

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/menu-items?ids=<uuid>,<uuid>`
- `POST /api/order-quotes`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:id`
- `PATCH /api/orders/:id/delivery`
- `DELETE /api/orders/:id`

### 4. Configure the Expo app

```bash
cp src/frontend-mobile/.env.example src/frontend-mobile/.env
npm --prefix src/frontend-mobile install
```

Set `EXPO_PUBLIC_API_BASE_URL` in `src/frontend-mobile/.env` for the device
target you use:

```dotenv
# Android Emulator
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:3000

# iOS Simulator
# EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

For a physical device, set the mobile URL to the development machine's LAN IP,
for example `http://192.168.1.10:3000`, and keep both devices on the same Wi-Fi.
Use the same value for both variables. `AI_API_KEY` is optional for the hackathon
demo; leave it blank to use the deterministic local KFC assistant.

Choose the AI provider only in `src/backend/.env`:

```dotenv
# Recommended OpenRouter / Qwen configuration for the intent-search agent
AI_PROVIDER=openrouter
AI_API_KEY=sk-or-v1-...
AI_MODEL_NAME=qwen/qwen3-30b-a3b-instruct-2507
AI_MAX_OUTPUT_TOKENS=1024

# Direct OpenAI remains supported
# AI_PROVIDER=openai
# AI_MODEL_NAME=gpt-4.1-mini
```

Restart the backend after changing providers or models. Never add the AI key to
an `EXPO_PUBLIC_*` variable because those values are bundled into the mobile app.

### Intent-driven menu search

The realtime agent extracts a structured menu intent before searching.
PostgreSQL ranks only available, in-stock items using weighted full-text search
over item name, slug, type, and description, expands matching categories, and
falls back to trigram similarity for typos. Apply the committed migration before
running the backend against a database:

```bash
npm --prefix src/backend run db:migrate
npm --prefix src/backend run db:seed
```

### 5. Run the mobile app

```bash
npm --prefix src/frontend-mobile start -- --clear
```

Scan the generated QR code in Expo Go, or press `a` to open an Android emulator.
For LAN mode, the phone and development machine must be on the same Wi-Fi. Use
`--tunnel` when LAN discovery is unavailable.

## Demo Login

After running the database seed, use this active account in the mobile login
screen:

```text
Email:    customer1@example.com
Password: DemoPassword123!
```

`blocked@example.com` uses the same password and is intended to verify the
unavailable-account error path.

## Verification

```bash
# Backend type checks and Prisma schema validation
npm --prefix src/backend run lint

# Backend unit and HTTP API tests
npm --prefix src/backend run test

# Expo TypeScript and Android bundle checks
npm --prefix src/frontend-mobile run typecheck
npm --prefix src/frontend-mobile exec expo export -- --platform android --output-dir /tmp/kfc-mobile-export
```

## Useful Commands

| Area | Command | Purpose |
| --- | --- | --- |
| Database | `docker compose --env-file src/backend/.env -f src/backend/docker-compose.yml up -d` | Start PostgreSQL 16. |
| Database | `docker compose --env-file src/backend/.env -f src/backend/docker-compose.yml down` | Stop PostgreSQL and retain its volume. |
| Backend | `npm --prefix src/backend run dev` | Run the API with file watching. |
| Backend | `npm --prefix src/backend run db:migrate` | Apply committed Prisma migrations. |
| Backend | `npm --prefix src/backend run db:migrate:dev` | Create and apply a development migration. |
| Backend | `npm --prefix src/backend run db:seed` | Seed catalog and demo data. |
| Backend | `npm --prefix src/backend run db:reset` | Reset, migrate, and seed the local database. |
| Mobile | `npm --prefix src/frontend-mobile start` | Start Expo Metro. |
| Mobile | `npm --prefix src/frontend-mobile run android` | Open the Expo app on Android. |
| Mobile | `npm --prefix src/frontend-mobile run typecheck` | Run strict TypeScript checks. |

## Repository Layout

```text
assets/
├── data/kfc_catalog.json             # Seed catalog source
└── image/                            # Shared product and brand assets
src/
├── backend/
│   ├── prisma/                       # Schema, migrations, and seed pipeline
│   ├── src/auth/                     # Password hashing, sessions, JWT services
│   ├── src/http/app.ts               # HTTP router and common error envelope
│   ├── src/menu-items/               # Menu candidate-ID lookup service
│   ├── src/orders/                   # Quote, order, stock, and delivery logic
│   └── tests/                        # Auth, menu, and order automated tests
└── frontend-mobile/
    ├── App.tsx                       # Expo root and authenticated app gate
    ├── LoginScreen.tsx               # Email/password API login screen
    ├── services/authService.ts        # Axios auth API and Expo SecureStore tokens
    ├── pages/                        # Login/chat route-level screens
    ├── components/                   # Reusable mobile UI components
    ├── theme.ts                      # Shared design tokens
    ├── AGENTS.md                     # Scoped guide for coding agents
    └── README.md                     # Detailed mobile-module documentation
```

## Authentication Contract

The mobile app sends this request to `POST /api/auth/login`:

```json
{
  "email": "customer1@example.com",
  "password": "DemoPassword123!",
  "device_id": "expo-device-id"
}
```

On success the API returns `access_token`, `refresh_token`, `expires_in`, and a
public `user` object. The app maps this response to its `AuthSession` type and
stores tokens in Expo SecureStore. Do not commit `.env` files, secrets, generated
Expo state, native build output, or dependency directories.

## Environment Notes

- Keep `src/backend/.env` and `src/frontend-mobile/.env` local only. Start from
  their respective `.env.example` files.
- `AUTH_ACCESS_TOKEN_SECRET`, `AUTH_REFRESH_TOKEN_SECRET`, and
  `AUTH_TOKEN_PEPPER` must be unique development secrets. The pepper is an
  additional server-side secret used while deriving password hashes; it must not
  be sent to the mobile app.
- Android emulators reach a local backend through `http://10.0.2.2:<port>`.
  Physical devices require the development machine's LAN IP and the same Wi-Fi,
  unless Expo tunnel mode is used for Metro access.
