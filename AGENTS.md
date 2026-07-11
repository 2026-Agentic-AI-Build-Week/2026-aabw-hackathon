# Repository Guidelines

## Project Structure & Module Organization

This repository is a full-stack hackathon workspace for KFC conversational
ordering. The root contains project-wide documentation and shared static
resources. Keep backend application code, database files, and backend-specific
configuration under `src/backend/`; place backend checks under
`src/backend/tests/` and shared static resources under `assets/`. Keep the Expo
React Native application and its scoped documentation under `src/frontend-mobile/`.

The backend currently provides authentication, menu item lookup, stock-aware
order quotes and creation, delivery updates, cancellations, and order listing.
The mobile application integrates authentication and a Socket.IO realtime text
conversation with the KFC Ordering Bot. The chat service persists a per-user
session, calls OpenAI only when configured, and otherwise uses a deterministic
development fallback.

Update this guide and `README.md` whenever the layout or primary entry point changes. Do not commit generated output, local environments, credentials, or editor metadata; add the relevant patterns to `.gitignore` first.

## Build, Test, and Development Commands

The database toolchain uses PostgreSQL 16 in Docker, Prisma ORM, TypeScript, and Vitest. Use the documented command set:

- `docker compose --env-file src/backend/.env -f src/backend/docker-compose.yml up -d` — start PostgreSQL locally.
- `npm --prefix src/backend run db:generate` — regenerate Prisma Client after pulling schema changes.
- `npm --prefix src/backend run db:migrate` — apply committed database migrations.
- `npm --prefix src/backend run db:seed` — import catalog and demo business data.
- `npm --prefix src/backend run test` — run the complete backend test suite.
- `npm --prefix src/backend run lint` — check TypeScript and Prisma schema rules.
- `npm --prefix src/backend run db:migrate:dev` — create and apply development migrations.
- `npm --prefix src/backend run dev` — start the HTTP API on `HOST` and `PORT` from `src/backend/.env`.
- `npm --prefix src/frontend-mobile run typecheck` — run strict TypeScript checks for the Expo app.
- `npm --prefix src/frontend-mobile start -- --clear` — start Expo Metro with a cleared cache.

Dependencies are pinned in each module's `package.json`. Do not assume globally
installed Prisma, Expo, or TypeScript tooling. Run package commands through npm
with `--prefix` or from the relevant module directory.

## Environment and Networking

Copy each `.env.example` to a local `.env`; never commit either local file.
Backend Docker and Prisma use `src/backend/.env`. The mobile app uses
`EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_SOCKET_URL` from
`src/frontend-mobile/.env`. Backend-only AI credentials (`AI_API_KEY` and
`AI_MODEL_NAME`) remain in `src/backend/.env` and must never be exposed to Expo.

- Android Emulator: `http://10.0.2.2:3000`
- iOS Simulator: `http://localhost:3000`
- Physical device: `http://<development-machine-LAN-IP>:3000`, with the backend
  bound to `0.0.0.0` and both devices on the same Wi-Fi.

If the backend fails with `EADDRINUSE`, identify and stop the process holding
the configured port or choose another `PORT` and update the mobile base URL.

## Coding Style & Naming Conventions

Use the formatter and linter standard for the selected language, committed with repository configuration. Until then, use spaces rather than tabs, UTF-8 files, and a final newline. Choose descriptive names: `snake_case` for Python files and functions, `camelCase` for JavaScript/TypeScript variables, and `PascalCase` for classes and components. Keep modules focused and avoid mixing configuration, business logic, and external-service adapters.

## Testing Guidelines

Every backend behavior change should include an automated Vitest test. Name tests
after observable behavior, such as `auth-api.test.ts` or `order-service.test.ts`.
Cover successful paths, validation failures, stock/unavailability handling, and
external-service errors. Bug fixes should include a regression test. Run the full
backend suite and mobile typecheck before opening a pull request.

## Commit & Pull Request Guidelines

Use short, imperative subjects such as `Add menu item lookup`; keep each commit
scoped to one logical change. Pull requests should explain the problem and
solution, list verification commands, link relevant issues, and include
screenshots or logs for visible behavior. Call out database migrations,
configuration changes, new dependencies, and known follow-up work.
