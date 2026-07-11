# Repository Guidelines

## Project Structure & Module Organization

This repository is an early-stage hackathon workspace. The root currently contains `README.md` for the project overview and `plan.md` for working notes. Keep top-level files limited to project-wide documentation and configuration. As implementation is added, place application code under `src/`, automated checks under `tests/`, and static resources under `assets/`. Mirror source paths in the test tree where practical; for example, test `src/agents/planner.py` in `tests/agents/test_planner.py`.

Update this guide and `README.md` whenever the layout or primary entry point changes. Do not commit generated output, local environments, credentials, or editor metadata; add the relevant patterns to `.gitignore` first.

## Build, Test, and Development Commands

No build system, dependency manifest, or test runner has been committed yet. Before adding implementation, document the chosen toolchain in `README.md` and expose a small, predictable command set. Prefer standard commands such as:

- `make run` — start the project locally.
- `make test` — run the complete automated test suite.
- `make lint` — check formatting and static-analysis rules.

If `make` is not adopted, list the exact ecosystem commands here (for example, `npm test` or `pytest`). Never assume globally installed dependencies; pin them in the appropriate manifest.

## Coding Style & Naming Conventions

Use the formatter and linter standard for the selected language, committed with repository configuration. Until then, use spaces rather than tabs, UTF-8 files, and a final newline. Choose descriptive names: `snake_case` for Python files and functions, `camelCase` for JavaScript/TypeScript variables, and `PascalCase` for classes and components. Keep modules focused and avoid mixing configuration, business logic, and external-service adapters.

## Testing Guidelines

Every behavior change should include an automated test once a framework is selected. Name tests after observable behavior, such as `test_rejects_expired_token` or `planner.test.ts`. Cover successful paths, validation failures, and external-service errors. Bug fixes should include a regression test. Run the full suite before opening a pull request.

## Commit & Pull Request Guidelines

History currently contains only `first commit`, so no established convention exists. Use short, imperative subjects such as `Add agent planning workflow`; keep each commit scoped to one logical change. Pull requests should explain the problem and solution, list verification commands, link relevant issues, and include screenshots or logs for visible behavior. Call out configuration changes, new dependencies, and known follow-up work.
