# Intent-Driven Full-Text Menu Search Implementation Plan

> **Implementation mode:** Execute task-by-task with tests first. This plan replaces alias-first menu lookup with structured intent extraction, PostgreSQL full-text search, ranked category expansion, and typo fallback.

## Goal

Turn natural-language ordering messages into validated menu-search intent, retrieve authoritative menu/category results from PostgreSQL, and let the AI produce concise ordering guidance from those results. The backend remains the source of truth for menu names, prices, availability, and future draft-order state.

## MVP Architecture

```text
Mobile user message
  -> authenticated Socket.IO user_chat
  -> recent persisted conversation context
  -> Qwen structured intent extraction
  -> runtime validation
  -> category full-text search
  -> menu-item full-text search + category expansion
  -> trigram typo fallback when FTS has no strong result
  -> deterministic ranking and availability filter
  -> Qwen natural-language response
  -> persisted assistant message
  -> Socket.IO ai_response
```

## Search Contract

```ts
export type MenuIntent = {
  action: "BROWSE_MENU" | "SEARCH_ITEM" | "REFINE_SELECTION" | "ASK_CLARIFICATION" | "UNSUPPORTED";
  foodQuery: string | null;
  categoryQuery: string | null;
  itemType: string | null;
  quantity: number | null;
  preferences: string[];
  referencedSelection: "CURRENT" | "PREVIOUS" | null;
  needsClarification: boolean;
  clarificationQuestion: string | null;
};
```

The model extracts intent only. It does not invent menu IDs, prices, availability, or order status.

## Ranking Policy

1. Exact normalized item name.
2. Exact item slug.
3. Weighted full-text match on item name/slug.
4. Items belonging to a matched category.
5. Full-text match on item type.
6. Full-text match on description.
7. Trigram similarity fallback for misspellings.

Only `is_available = true` and `stock_quantity > 0` items are returned to the AI.

---

## Task 1: Define Intent and Search Types

**Files**

- Create `src/backend/src/ai/menu-intent.ts`
- Update `src/backend/src/ai/menu-search.ts`
- Create `src/backend/tests/ai/menu-intent.test.ts`

**Steps**

1. Write failing tests for valid search intent, clarification intent, quantities, follow-up references, and malformed model output.
2. Define `MenuIntent`, `MenuSearchInput`, `MenuSearchResult`, `CategorySearchResult`, and a structured error type.
3. Implement strict runtime parsing without `any`; reject unknown actions and invalid quantities.
4. Preserve the existing alias helper only as a temporary fallback for malformed provider output.
5. Run `npm --prefix src/backend exec vitest run tests/ai/menu-intent.test.ts`.

## Task 2: Add PostgreSQL Search Infrastructure

**Files**

- Create `src/backend/prisma/migrations/<timestamp>_add_menu_full_text_search/migration.sql`
- Update `src/backend/prisma/schema.prisma` only for supported indexes/extensions metadata when needed
- Create `src/backend/tests/ai/menu-search-sql.test.ts`

**Steps**

1. Enable `unaccent` and `pg_trgm` with `CREATE EXTENSION IF NOT EXISTS`.
2. Add an immutable SQL normalization wrapper around `unaccent(lower(value))` so expression indexes are safe.
3. Add weighted item search vectors covering `name` and `slug` at weight A, `item_type` at B, and `description` at C.
4. Add category search vectors covering `name` at A and `slug` at B.
5. Add GIN indexes for item/category FTS and trigram indexes for normalized names/slugs.
6. Keep migration reversible by explicitly dropping indexes, helper functions, vectors/triggers, and extensions only when repository ownership permits.
7. Apply with `npm --prefix src/backend run db:migrate:dev` against the local development database.

## Task 3: Implement Ranked Category Search

**Files**

- Create `src/backend/src/ai/category-search-repository.ts`
- Create `src/backend/tests/ai/category-search-repository.test.ts`

**Steps**

1. Write failing repository tests for accented, unaccented, English-like, partial, and misspelled category queries.
2. Implement parameterized Prisma `$queryRaw` queries; never interpolate user input into SQL strings.
3. Search `Category.name` and `Category.slug`, filter `isActive`, and return rank/similarity metadata.
4. Limit category results to five and apply a minimum relevance threshold.
5. Return matched category IDs for expansion into menu items.

## Task 4: Implement Ranked Menu-Item Search

**Files**

- Replace query logic in `src/backend/src/ai/menu-search.ts`
- Create or extend `src/backend/tests/ai/menu-search-repository.test.ts`

**Steps**

1. Test exact name, slug, item type, description, category expansion, stock exclusion, unavailable exclusion, and typo fallback.
2. Accept structured `MenuSearchInput` instead of one raw query string.
3. Execute weighted FTS across `name`, `slug`, `item_type`, and `description`.
4. Include items joined through matched categories using `menu_item_categories`.
5. If FTS returns no result above threshold, run trigram similarity on normalized item name and slug.
6. Deduplicate results and calculate one deterministic score.
7. Return at most eight backend results; the AI may present at most three.

## Task 5: Extract Structured Intent with Qwen

**Files**

- Create `src/backend/src/ai/menu-intent-extractor.ts`
- Update `src/backend/src/ai/openai-ai-client.ts`
- Create `src/backend/tests/ai/menu-intent-extractor.test.ts`

**Steps**

1. Define a forced `analyze_menu_intent` function/tool matching `MenuIntent`.
2. Send the latest user message plus up to twelve recent turns to Qwen.
3. Instruct Qwen to resolve follow-ups such as “that combo”, “five of those”, and “make it spicy” using context.
4. Parse common provider deviations but validate the final object strictly.
5. Fall back to a conservative `SEARCH_ITEM` using the current message when extraction is malformed.
6. Do not expose chain-of-thought; request only structured intent fields.

## Task 6: Orchestrate Intent to Action

**Files**

- Create `src/backend/src/ai/ordering-agent.ts`
- Update `src/backend/src/realtime/chat-handler.ts`
- Update `src/backend/src/server.ts`
- Create `src/backend/tests/ai/ordering-agent.test.ts`

**Steps**

1. Route clarification intents directly to one concise question.
2. Search categories first when `categoryQuery` exists.
3. Search menu items using food query, item type, and matched category IDs.
4. Give Qwen only authoritative search results for response generation.
5. Tell Qwen to state when an exact product is unavailable and offer the nearest real alternatives.
6. Persist extracted intent and tool result as internal/tool conversation messages when the existing schema supports it.
7. Keep order creation disabled until the separate confirmation-token workflow is implemented.

## Task 7: Add Ordering Session State

**Files**

- Create `src/backend/src/ai/order-draft.ts`
- Update `src/backend/src/realtime/prisma-chat-repository.ts`
- Create `src/backend/tests/ai/order-draft.test.ts`

**Steps**

1. Define a channel-neutral draft containing selected item IDs, quantities, preferences, unresolved fields, and last referenced selection.
2. Update the draft only from validated menu results, never raw model names.
3. Support add, replace, remove, and quantity-update intents.
4. Keep the draft associated with the authenticated conversation session so text and future Agora voice can reuse it.
5. Do not create a real order without explicit confirmation in a future phase.

## Task 8: Observability and Error Handling

**Files**

- Update `src/backend/src/realtime/socket-server.ts`
- Update `src/backend/src/ai/ordering-agent.ts`
- Update `README.md`

**Steps**

1. Log provider, model, session ID, intent action, search-result count, and latency without logging API keys or raw sensitive messages.
2. Distinguish intent extraction, database search, provider credit/rate-limit, and response-generation errors.
3. Return retryable user-safe socket errors while preserving detailed server logs.
4. Document Qwen/OpenRouter configuration and database extension requirements.

## Task 9: End-to-End Verification

**Test conversations**

```text
How about chickens?
Tenders
Give me five of those
Make two of them spicy
Do you have wings?
Cho mình combo gà cho 2 người
Thêm Pepsi không đường
```

**Expected behavior**

- “Tenders” finds actual Tender products from seeded data.
- “Five of those” resolves the last selected Tender item.
- “Wings” clearly reports exact availability and proposes real nearby chicken products.
- Vietnamese and English inputs return authoritative prices and availability.
- No response claims an order was submitted or paid.

**Verification commands**

```bash
npm --prefix src/backend run db:migrate
npm --prefix src/backend run db:seed
npm --prefix src/backend run lint
npm --prefix src/backend run test
npm --prefix src/frontend-mobile run typecheck
```

## Deferred After Hackathon MVP

- Embedding/vector semantic search.
- Redis-distributed conversation locks.
- Production-grade order confirmation/payment.
- Agora voice media integration.
- Personalized recommendations and loyalty-aware ranking.

The intent, search, draft, and confirmation interfaces must remain channel-neutral so a future voice adapter can reuse them without duplicating ordering logic.
