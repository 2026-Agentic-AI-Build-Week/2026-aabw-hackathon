# Chat Greeting, Session Language, and Selection Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent greeting-only messages from opening the menu, preserve the first session language across messages, and select named products from validated suggestions without unrelated full-text matches.

**Architecture:** Add pure `conversation-language` and `suggestion-resolver` modules. Persist `responseLanguage` in the existing JSON order draft, then have `OrderingAgent` initialize the language, short-circuit greetings, resolve suggestions before database search, and pass an explicit language to deterministic responders.

**Tech Stack:** TypeScript, Prisma JSON persistence, Vitest, OpenAI-compatible intent extraction.

---

## File Structure

- Create `src/backend/src/ai/conversation-language.ts`: language types, neutral-aware detection, greeting-only detection, localized static messages.
- Create `src/backend/src/ai/suggestion-resolver.ts`: normalized ordinal/name/slug resolution against validated suggestions.
- Modify `src/backend/src/ai/order-draft.ts`: own `responseLanguage` default and immutable initialization transition.
- Modify `src/backend/src/ai/prisma-order-draft-store.ts`: parse `responseLanguage` safely from persisted draft JSON.
- Modify `src/backend/src/ai/ordering-agent.ts`: coordinate language initialization, greeting exit, suggestion resolution, ambiguity, and localized helpers.
- Modify `src/backend/src/ai/validated-menu-responder.ts`: render from explicit language rather than latest-message detection.
- Modify `src/backend/src/ai/demo-ai-client.ts`: keep demo intent/responder contracts compatible with explicit language.
- Modify `src/backend/tests/ai/order-draft.test.ts`, `order-draft-persistence.test.ts`, `ordering-agent.test.ts`, `validated-menu-responder.test.ts`, and `demo-ai-client.test.ts`.
- Create `src/backend/tests/ai/conversation-language.test.ts` and `suggestion-resolver.test.ts`.

### Task 1: Add pure language and greeting primitives

**Files:**
- Create: `src/backend/src/ai/conversation-language.ts`
- Test: `src/backend/tests/ai/conversation-language.test.ts`

- [ ] **Step 1: Write failing language-detection tests**

```ts
import { describe, expect, it } from "vitest";
import { detectInitialConversationLanguage, isGreetingOnly } from "../../src/ai/conversation-language.js";

describe("conversation language", () => {
  it("detects Vietnamese and English first messages", () => {
    expect(detectInitialConversationLanguage("Tôi muốn ăn gà")).toBe("vi");
    expect(detectInitialConversationLanguage("Hi, I want a burger")).toBe("en");
  });

  it("defaults neutral product-only messages to Vietnamese", () => {
    expect(detectInitialConversationLanguage("Burger")).toBe("vi");
  });

  it("recognizes greeting-only messages without consuming a request", () => {
    expect(isGreetingOnly("Hi!")).toBe(true);
    expect(isGreetingOnly("Xin chào")).toBe(true);
    expect(isGreetingOnly("Hi, show me burgers")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm --prefix src/backend run test -- tests/ai/conversation-language.test.ts`

Expected: FAIL because `conversation-language.ts` does not exist.

- [ ] **Step 3: Implement the pure module**

```ts
export type ConversationLanguage = "vi" | "en";

const vietnameseSignal = /[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]|\b(?:tôi|mình|muốn|không|món|đặt|xem)\b/iu;
const englishSignal = /\b(?:hi|hello|hey|i|want|show|menu|please|order)\b/iu;
const greetingOnly = /^(?:hi|hello|hey|chào|xin chào|chào bạn)[!,.\s]*$/iu;

export function detectInitialConversationLanguage(text: string): ConversationLanguage {
  if (vietnameseSignal.test(text)) return "vi";
  if (englishSignal.test(text)) return "en";
  return "vi";
}

export function isGreetingOnly(text: string): boolean {
  return greetingOnly.test(text.trim());
}
```

- [ ] **Step 4: Run the focused test to verify GREEN**

Run: `npm --prefix src/backend run test -- tests/ai/conversation-language.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the isolated primitive**

```bash
git add src/backend/src/ai/conversation-language.ts src/backend/tests/ai/conversation-language.test.ts
git commit -m "Add conversation language detection"
```

### Task 2: Add deterministic suggestion resolution

**Files:**
- Create: `src/backend/src/ai/suggestion-resolver.ts`
- Test: `src/backend/tests/ai/suggestion-resolver.test.ts`

- [ ] **Step 1: Write failing resolver tests**

```ts
const suggestions = [
  { id: "yo", name: "Burger Gà Yo", slug: "burger-ga-yo", itemType: "food", description: null, price: 30000, currency: "VND", categories: [], score: 1 },
  { id: "tender", name: "3 Miếng Gà Rán Tender", slug: "ga-ran-tender", itemType: "food", description: null, price: 42000, currency: "VND", categories: [], score: 1 },
];

expect(resolveSuggestion("Gà Yo đi", suggestions)).toEqual({ kind: "match", suggestion: suggestions[0] });
expect(resolveSuggestion("số 1", suggestions)).toEqual({ kind: "match", suggestion: suggestions[0] });
expect(resolveSuggestion("Gà", suggestions)).toEqual({ kind: "ambiguous", suggestions });
expect(resolveSuggestion("Pepsi", suggestions)).toEqual({ kind: "none" });
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm --prefix src/backend run test -- tests/ai/suggestion-resolver.test.ts`

Expected: FAIL because `suggestion-resolver.ts` does not exist.

- [ ] **Step 3: Implement normalization and discriminated resolution**

```ts
export type SuggestionResolution =
  | { kind: "match"; suggestion: MenuSearchResult }
  | { kind: "ambiguous"; suggestions: MenuSearchResult[] }
  | { kind: "none" };

export function resolveSuggestion(text: string, suggestions: readonly MenuSearchResult[]): SuggestionResolution {
  const ordinal = readOrdinal(text);
  if (ordinal !== null && suggestions[ordinal]) return { kind: "match", suggestion: suggestions[ordinal] };
  const query = normalizeSelectionText(text);
  const matches = suggestions.filter((suggestion) => matchesSuggestion(query, suggestion));
  return matches.length === 1 ? { kind: "match", suggestion: matches[0] }
    : matches.length > 1 ? { kind: "ambiguous", suggestions: matches }
    : { kind: "none" };
}
```

Implement `normalizeSelectionText` with NFD diacritic removal, lowercase conversion, punctuation removal, suffix removal for `đi`, `nhé`, `nha`, and `please`, then whitespace collapse. `matchesSuggestion` must compare normalized name and slug with exact, full-name containment, then unique token-subset behavior.

- [ ] **Step 4: Run the focused test to verify GREEN**

Run: `npm --prefix src/backend run test -- tests/ai/suggestion-resolver.test.ts`

Expected: PASS with exact, ordinal, ambiguous, and no-match cases.

- [ ] **Step 5: Commit the resolver**

```bash
git add src/backend/src/ai/suggestion-resolver.ts src/backend/tests/ai/suggestion-resolver.test.ts
git commit -m "Resolve named menu suggestions safely"
```

### Task 3: Persist response language in the draft

**Files:**
- Modify: `src/backend/src/ai/order-draft.ts`
- Modify: `src/backend/src/ai/prisma-order-draft-store.ts`
- Test: `src/backend/tests/ai/order-draft.test.ts`
- Test: `src/backend/tests/ai/order-draft-persistence.test.ts`

- [ ] **Step 1: Write failing draft and persistence tests**

```ts
expect(createEmptyOrderDraft().responseLanguage).toBeNull();
expect(withResponseLanguage(createEmptyOrderDraft(), "vi")).toMatchObject({ responseLanguage: "vi" });
expect(withResponseLanguage({ ...createEmptyOrderDraft(), responseLanguage: "en" }, "vi").responseLanguage).toBe("en");
expect(parseOrderDraft({ items: [], preferences: [], unresolvedFields: [], responseLanguage: "en" }).responseLanguage).toBe("en");
expect(parseOrderDraft({ items: [], preferences: [], unresolvedFields: [], responseLanguage: "fr" }).responseLanguage).toBeNull();
```

- [ ] **Step 2: Run focused draft tests to verify RED**

Run: `npm --prefix src/backend run test -- tests/ai/order-draft.test.ts tests/ai/order-draft-persistence.test.ts`

Expected: FAIL because the draft does not yet expose `responseLanguage` or `withResponseLanguage`.

- [ ] **Step 3: Add the persisted field and immutable initializer**

```ts
export type OrderDraft = {
  responseLanguage: ConversationLanguage | null;
  // existing draft fields
};

export function withResponseLanguage(draft: OrderDraft, language: ConversationLanguage): OrderDraft {
  return draft.responseLanguage ? draft : { ...draft, responseLanguage: language };
}
```

Initialize `responseLanguage: null` in `createEmptyOrderDraft`. In `parseOrderDraft`, accept only `"vi"` and `"en"`; all other values become `null`.

- [ ] **Step 4: Run focused draft tests to verify GREEN**

Run: `npm --prefix src/backend run test -- tests/ai/order-draft.test.ts tests/ai/order-draft-persistence.test.ts`

Expected: PASS with existing and new persistence cases.

- [ ] **Step 5: Commit the persistence transition**

```bash
git add src/backend/src/ai/order-draft.ts src/backend/src/ai/prisma-order-draft-store.ts src/backend/tests/ai/order-draft.test.ts src/backend/tests/ai/order-draft-persistence.test.ts
git commit -m "Persist chat response language"
```

### Task 4: Localize the validated responder explicitly

**Files:**
- Modify: `src/backend/src/ai/ordering-agent.ts`
- Modify: `src/backend/src/ai/validated-menu-responder.ts`
- Modify: `src/backend/src/ai/demo-ai-client.ts`
- Test: `src/backend/tests/ai/validated-menu-responder.test.ts`
- Test: `src/backend/tests/ai/demo-ai-client.test.ts`

- [ ] **Step 1: Write failing responder tests**

```ts
await expect(responder.generate(input, intent, items, "vi")).resolves.toContain("Mình tìm thấy");
await expect(responder.generate({ ...input, text: "Burger" }, intent, items, "vi")).resolves.toContain("Mình tìm thấy");
await expect(responder.generate(input, intent, items, "en")).resolves.toContain("I found");
```

- [ ] **Step 2: Run focused responder tests to verify RED**

Run: `npm --prefix src/backend run test -- tests/ai/validated-menu-responder.test.ts tests/ai/demo-ai-client.test.ts`

Expected: FAIL because `MenuResponder.generate` does not yet receive an explicit language.

- [ ] **Step 3: Change the responder contract**

```ts
export interface MenuResponder {
  generate(input: ChatAiInput, intent: MenuIntent, results: MenuSearchResult[], language: ConversationLanguage): Promise<string>;
}
```

Update `ValidatedMenuResponder` and `DemoMenuResponder` to branch only on `language`; remove their latest-message language detectors. Update every `generate` call and test double to receive the fourth argument.

- [ ] **Step 4: Run focused responder tests to verify GREEN**

Run: `npm --prefix src/backend run test -- tests/ai/validated-menu-responder.test.ts tests/ai/demo-ai-client.test.ts`

Expected: PASS; a stored Vietnamese language must keep replies Vietnamese after a neutral `Burger` message.

- [ ] **Step 5: Commit responder localization**

```bash
git add src/backend/src/ai/ordering-agent.ts src/backend/src/ai/validated-menu-responder.ts src/backend/src/ai/demo-ai-client.ts src/backend/tests/ai/validated-menu-responder.test.ts src/backend/tests/ai/demo-ai-client.test.ts
git commit -m "Render menu replies in session language"
```

### Task 5: Coordinate greeting and named selection in the ordering agent

**Files:**
- Modify: `src/backend/src/ai/ordering-agent.ts`
- Test: `src/backend/tests/ai/ordering-agent.test.ts`

- [ ] **Step 1: Write failing end-to-end agent tests**

```ts
it("greets without browsing the menu", async () => {
  await agent.respond({ userId: "user-1", sessionId: "session-1", text: "Hi", history: [] });
  expect(extractor.extract).not.toHaveBeenCalled();
  expect(search.browse).not.toHaveBeenCalled();
  expect(search.search).not.toHaveBeenCalled();
  expect(drafts.save).toHaveBeenCalledWith("session-1", expect.objectContaining({ responseLanguage: "en" }));
});

it("resolves a named suggestion without a database search", async () => {
  const draft = { ...createEmptyOrderDraft(), responseLanguage: "vi" as const, suggestions: burgerSuggestions };
  await agent.respond({ userId: "user-1", sessionId: "session-1", text: "Gà Yo đi", history: [] });
  expect(search.search).not.toHaveBeenCalled();
  expect(drafts.save).toHaveBeenCalledWith("session-1", expect.objectContaining({ items: [{ menuItemId: "burger-yo", name: "Burger Gà Yo", quantity: 1 }] }));
});

it("asks for clarification instead of selecting an ambiguous suggestion", async () => {
  await agent.respond({ userId: "user-1", sessionId: "session-1", text: "Gà", history: [] });
  expect(search.search).not.toHaveBeenCalled();
  expect(drafts.save).not.toHaveBeenCalledWith("session-1", expect.objectContaining({ items: expect.any(Array) }));
});
```

- [ ] **Step 2: Run the focused agent test to verify RED**

Run: `npm --prefix src/backend run test -- tests/ai/ordering-agent.test.ts`

Expected: FAIL because the agent currently invokes intent extraction/search for greetings and only resolves numeric suggestions.

- [ ] **Step 3: Implement greeting initialization before intent extraction**

At the start of `respond`, load the current draft, initialize `responseLanguage` once with `withResponseLanguage`, and keep `language = initializedDraft.responseLanguage ?? "vi"`. Before `extractor.extract`, check `isGreetingOnly(input.text)`. On greeting: save the initialized draft, return `greetingMessage(language)`, and make no menu/LLM calls.

- [ ] **Step 4: Implement suggestion resolution before database search**

Replace the numeric-only `readSuggestion` use with `resolveSuggestion(input.text, currentDraft?.suggestions ?? [])` for selection/refinement turns. A `match` becomes the sole `results` array and flows through `updateOrderDraft`. An `ambiguous` result returns `ambiguousSuggestionMessage(language, candidates)` without saving item changes or searching. A `none` result continues to existing category/full-text search.

- [ ] **Step 5: Localize remaining deterministic agent messages**

Update `preferenceClarification`, `preferenceUpdatedMessage`, `missingDeliveryMessage`, `renderCurrentDraft`, and checkout fallback helpers to accept `ConversationLanguage`. Pass the persisted language to the responder. Do not reintroduce message-text language inference.

- [ ] **Step 6: Run the focused agent test to verify GREEN**

Run: `npm --prefix src/backend run test -- tests/ai/ordering-agent.test.ts`

Expected: PASS with greeting no-search, locked language, exact named selection, ambiguity, ordinal regression, negative preferences, and checkout tests.

- [ ] **Step 7: Commit orchestration**

```bash
git add src/backend/src/ai/ordering-agent.ts src/backend/tests/ai/ordering-agent.test.ts
git commit -m "Handle greetings and named menu selections"
```

### Task 6: Run full verification and document the behavior

**Files:**
- Modify: `README.md` only if the chat behavior section is absent.

- [ ] **Step 1: Add a concise chat behavior note if needed**

Document that first-message language is retained for the session, greeting-only messages do not open the menu, and named selections are resolved from the currently displayed suggestions.

- [ ] **Step 2: Run static validation**

Run: `npm --prefix src/backend run lint`

Expected: TypeScript and Prisma validation pass.

- [ ] **Step 3: Run all backend tests**

Run: `npm --prefix src/backend run test`

Expected: all backend tests pass.

- [ ] **Step 4: Run mobile type validation**

Run: `npm --prefix src/frontend-mobile run typecheck`

Expected: TypeScript exits successfully without errors.

- [ ] **Step 5: Review final changes and commit documentation**

```bash
git diff --check
git add README.md
git commit -m "Document reliable chat behavior"
```

If `README.md` did not change, skip the final commit and retain the previous task commits.

## Plan Self-Review

- **Spec coverage:** Tasks 1–5 cover language initialization, greeting handling, suggestion matching, ambiguity, JSON persistence, Socket-reconnect durability through draft persistence, and deterministic response language. Task 6 covers full regression verification.
- **Type consistency:** `ConversationLanguage` is owned by `conversation-language.ts`; `OrderDraft.responseLanguage` and `MenuResponder.generate(..., language)` use that same type. `SuggestionResolution` keeps unique, ambiguous, and absent matches explicit.
- **Placeholder scan:** This plan has no deferred implementation markers. Every code change identifies its owner file, tests, commands, and expected output.

