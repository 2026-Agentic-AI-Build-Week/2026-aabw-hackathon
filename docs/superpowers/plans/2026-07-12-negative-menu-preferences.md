# Negative Menu Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist negative menu-type preferences and enforce them across deterministic menu browsing and searching.

**Architecture:** The intent extractor produces allowlisted structured preference updates. The order draft owns session persistence, the ordering agent handles the preference transition without searching, and the Prisma menu adapter enforces exclusions in SQL. Existing JSON draft persistence avoids a database migration.

**Tech Stack:** TypeScript, OpenAI-compatible tool calling, Prisma, PostgreSQL, Vitest.

---

### Task 1: Define preference contracts

**Files:**
- Modify: `src/backend/src/ai/menu-intent.ts`
- Modify: `src/backend/src/ai/menu-intent-extractor.ts`
- Test: `src/backend/tests/ai/menu-intent.test.ts`

- [ ] Add failing parser tests for `UPDATE_PREFERENCES`, allowlisted exclusions, reversal updates, deduplication, and unknown values.
- [ ] Run `npm --prefix src/backend test -- tests/ai/menu-intent.test.ts` and verify the new tests fail.
- [ ] Add `MenuItemType`, `MenuPreferenceUpdates`, `UPDATE_PREFERENCES`, strict parsing, and provider schema/prompt guidance.
- [ ] Run the focused test and verify it passes.

### Task 2: Persist preference state

**Files:**
- Modify: `src/backend/src/ai/order-draft.ts`
- Modify: `src/backend/src/ai/prisma-order-draft-store.ts`
- Test: `src/backend/tests/ai/order-draft.test.ts`
- Test: `src/backend/tests/ai/order-draft-persistence.test.ts`

- [ ] Add failing tests for defaults, apply/remove transitions, quote invalidation, selected-item preservation, and JSON round trips.
- [ ] Run the two focused test files and verify failures.
- [ ] Add `menuPreferences` and a pure `applyMenuPreferenceUpdate` transition.
- [ ] Parse persisted preferences through the same item-type allowlist.
- [ ] Run the focused tests and verify they pass.

### Task 3: Enforce exclusions in menu search

**Files:**
- Modify: `src/backend/src/ai/menu-search.ts`
- Test: `src/backend/tests/ai/menu-search.test.ts`

- [ ] Add failing adapter tests proving browse and search exclude combo while unknown types are ignored.
- [ ] Run `npm --prefix src/backend test -- tests/ai/menu-search.test.ts` and verify failures.
- [ ] Extend the menu search inputs and add safe Prisma `NOT IN` clauses to browse and search.
- [ ] Run the focused test and verify it passes.

### Task 4: Orchestrate preference updates

**Files:**
- Modify: `src/backend/src/ai/ordering-agent.ts`
- Modify: `src/backend/src/ai/validated-menu-responder.ts`
- Test: `src/backend/tests/ai/ordering-agent.test.ts`
- Test: `src/backend/tests/ai/validated-menu-responder.test.ts`

- [ ] Add failing tests proving preference-only messages save without searching, later operations inherit exclusions, reversals remove exclusions, and empty filtered responses do not claim sold-out stock.
- [ ] Run the focused tests and verify failures.
- [ ] Add the deterministic preference transition/response and pass exclusions to browse/search.
- [ ] Update empty-result wording to distinguish active filters from unavailable stock.
- [ ] Run the focused tests and verify they pass.

### Task 5: Verify integration

**Files:**
- Modify: `README.md` only if configuration or behavior documentation is missing.

- [ ] Run `npm --prefix src/backend run lint` with the backend environment loaded.
- [ ] Run `npm --prefix src/backend run test` and verify the complete suite passes.
- [ ] Review `git diff --check` and the final diff for unrelated changes.

