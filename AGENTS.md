# Repository Guidelines

## Project Structure & Module Organization

This repository is an early-stage hackathon workspace. The root contains project-wide documentation and shared static resources. Keep backend application code, database files, and backend-specific configuration under `src/backend/`; place backend checks under `src/backend/tests/` and shared static resources under `assets/`. Mirror source paths in the backend test tree where practical; for example, test `src/backend/src/agents/planner.ts` in `src/backend/tests/agents/planner.test.ts`.

Update this guide and `README.md` whenever the layout or primary entry point changes. Do not commit generated output, local environments, credentials, or editor metadata; add the relevant patterns to `.gitignore` first.

## Build, Test, and Development Commands

The database toolchain uses PostgreSQL 16 in Docker, Prisma ORM, TypeScript, and Vitest. Use the documented command set:

- `make -C src/backend run` — start PostgreSQL locally.
- `make -C src/backend test` — run the complete backend test suite.
- `make -C src/backend lint` — check TypeScript and Prisma schema rules.
- `make -C src/backend db-migrate-dev` — create and apply development migrations.
- `make -C src/backend db-seed` — import catalog and demo business data.

Dependencies are pinned in `src/backend/package.json`. Do not assume globally installed Prisma or TypeScript tooling.

## Coding Style & Naming Conventions

Use the formatter and linter standard for the selected language, committed with repository configuration. Until then, use spaces rather than tabs, UTF-8 files, and a final newline. Choose descriptive names: `snake_case` for Python files and functions, `camelCase` for JavaScript/TypeScript variables, and `PascalCase` for classes and components. Keep modules focused and avoid mixing configuration, business logic, and external-service adapters.

## Testing Guidelines

Every behavior change should include an automated test once a framework is selected. Name tests after observable behavior, such as `test_rejects_expired_token` or `planner.test.ts`. Cover successful paths, validation failures, and external-service errors. Bug fixes should include a regression test. Run the full suite before opening a pull request.

## Commit & Pull Request Guidelines

History currently contains only `first commit`, so no established convention exists. Use short, imperative subjects such as `Add agent planning workflow`; keep each commit scoped to one logical change. Pull requests should explain the problem and solution, list verification commands, link relevant issues, and include screenshots or logs for visible behavior. Call out configuration changes, new dependencies, and known follow-up work.
