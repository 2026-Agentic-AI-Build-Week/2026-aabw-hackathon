# Chat Greeting, Session Language, and Selection Resolution Design

## Goal

Make the ordering conversation reliable in three observable cases:

1. A greeting such as `Hi` or `Xin chào` must not immediately display the menu.
2. The bot must respond in one language consistently for the whole conversation session, based on the first meaningful user message.
3. A named choice such as `Gà Yo đi` must select the matching item from the most recent validated suggestions instead of running a broad search that can add an unrelated product.

The design keeps menu facts, item selection, and ordering state deterministic. The LLM may classify intent, but it does not choose an arbitrary product or response language after the backend has established session state.

## Current Failure Analysis

### Greeting Falls Through to Menu Browsing

The ordering agent currently treats most non-checkout intents as either browse or search operations. If the model classifies `Hi` as `BROWSE_MENU`, the agent immediately calls `menuSearch.browse()` and renders menu items. There is no deterministic greeting guard before menu retrieval.

### Language Is Inferred from Only the Latest Message

`ValidatedMenuResponder` determines Vietnamese or English from `input.text`. A Vietnamese conversation can therefore switch to English when the user sends a menu term such as `Burger`, even though that word does not indicate a language change.

### Named Suggestions Are Not Resolved Locally

The agent resolves current suggestions only when the message begins with an ordinal number. A named reply such as `Gà Yo đi` is sent to full-text menu search. The alias expansion for `gà` includes chicken and tender terms, so an unrelated Tender item can rank above Burger Gà Yo. The first result is then persisted as the selected draft item.

## Session Language Contract

Extend `OrderDraft` with:

```ts
export type ConversationLanguage = "vi" | "en";

export type OrderDraft = {
  responseLanguage: ConversationLanguage | null;
  // existing fields
};
```

`responseLanguage` is persisted in `ConversationSession.draftState`, so it survives Socket disconnects and application restarts. Existing sessions without the field parse to `null`.

### Initial Language Detection

The backend determines the language from the first meaningful user message for which it can make a confident decision:

- Vietnamese diacritics or common Vietnamese words select `vi`.
- Common English greeting/order words select `en`.
- Menu names and brand/product tokens such as `Burger`, `Pepsi`, `Zinger`, numbers, punctuation, and emoji are language-neutral.
- If a message is neutral and no language has been stored, the MVP default is `vi`, matching the target demo audience.

Once stored, `responseLanguage` does not change during the conversation session. A future explicit language-switch feature is outside this MVP scope.

### Language Consumers

Every deterministic response receives the stored language rather than independently inspecting the latest text:

- greeting response;
- preference acknowledgement;
- menu browse/search result response;
- current draft response;
- clarification and missing delivery responses;
- quote/checkout helper messages where localized variants exist.

The LLM intent extractor still receives multilingual history, but its output cannot change the stored response language.

## Greeting Handling

Add a deterministic greeting detector before intent extraction or menu retrieval. It recognizes greeting-only messages after trimming punctuation and whitespace, including:

- English: `hi`, `hello`, `hey`;
- Vietnamese: `chào`, `xin chào`, `chào bạn`.

A greeting-only message returns a localized welcome and a short question:

```text
vi: Chào bạn! Mình có thể giúp bạn chọn món, xem thực đơn hoặc đặt hàng. Hôm nay bạn muốn ăn gì?
en: Hi! I can help you choose items, browse the menu, or place an order. What would you like today?
```

The greeting path must not call `browse`, `searchCategories`, or `search`. Messages that contain both a greeting and a concrete request, such as `Hi, show me burgers`, continue through normal intent extraction so the request is not discarded.

The greeting path initializes and saves `responseLanguage` if the session language has not yet been stored.

## Validated Suggestion Resolution

Create a focused suggestion resolver that examines only `OrderDraft.suggestions`, which already contains products validated against availability and stock.

### Normalization

Normalize both the user message and candidate fields by:

- Unicode decomposition and removal of Vietnamese diacritics;
- lowercase conversion;
- punctuation removal;
- removal of lightweight conversational suffixes such as `đi`, `nhé`, `nha`, `please`, and quantity phrases;
- whitespace collapsing.

Candidate text includes the suggestion name and slug. The resolver does not inspect arbitrary database IDs supplied by the model.

### Matching Priority

1. Existing ordinal match, such as `1`, `số 1`, or `món 1`.
2. Exact normalized suggestion name or slug.
3. User text contains the complete normalized suggestion name.
4. A unique token-subset match where all meaningful user tokens occur in exactly one suggestion.

The resolver returns a suggestion only when the best match is unique. Ambiguous matches return no selection and trigger a localized clarification listing the matching candidates. They must not silently choose the first item.

For the reported example, `Gà Yo đi` normalizes to `ga yo` and uniquely matches `Burger Gà Yo`, so the agent persists Burger Gà Yo without calling full-text search.

### Search Fallback

If no current suggestion matches and the intent contains a genuine product query, the agent may call full-text menu search. The search result is presented as options; it is not automatically added to the draft unless the intent contains an unambiguous quantity and selection action under existing ordering rules.

## Ordering Agent Data Flow

For each user message:

1. Load the order draft once.
2. Initialize `responseLanguage` when it is `null`.
3. If the message is greeting-only, save the initialized draft and return the localized greeting without invoking the LLM or menu search.
4. Extract intent for non-greeting messages.
5. Process checkout, delivery, preference, and draft-view actions using the stored language.
6. For `REFINE_SELECTION` or a reply following stored suggestions, run the validated suggestion resolver before database search.
7. If a unique suggestion matches, persist exactly that product and quantity.
8. If the match is ambiguous, return a clarification without changing draft items.
9. Otherwise, use the existing category/full-text search with persisted menu exclusions.
10. Render the response using `responseLanguage`.

## Component Boundaries

### `conversation-language.ts`

Owns `ConversationLanguage`, initial language detection, and neutral-token behavior. It has no database or LLM dependencies.

### `suggestion-resolver.ts`

Owns text normalization and deterministic resolution against validated `MenuSearchResult[]`. It returns a discriminated result: unique match, ambiguous candidates, or no match.

### `order-draft.ts` and `prisma-order-draft-store.ts`

Own the persisted `responseLanguage` field, backward-compatible parsing, and immutable state updates.

### `ordering-agent.ts`

Coordinates greeting handling, language initialization, suggestion resolution, search fallback, and draft persistence. It does not implement normalization algorithms inline.

### `validated-menu-responder.ts`

Renders localized menu responses from an explicit `ConversationLanguage`. It no longer guesses language from the latest user text.

## Error and Edge-Case Handling

- A missing or malformed persisted language becomes `null` and is initialized safely.
- Neutral first messages default to Vietnamese for the MVP.
- Greeting detection matches the entire greeting-only message and cannot swallow `Hi, show burgers`.
- Empty suggestion lists skip local resolution.
- Ambiguous suggestion names never add an item.
- Existing item exclusions still apply to database browse/search operations.
- Resolver normalization must not modify stored product names or user messages.
- A Socket reconnect uses the same persisted language and suggestions.

## Regression Test Matrix

1. `Hi` initializes English and returns a greeting without menu calls.
2. `Xin chào` initializes Vietnamese and returns a greeting without menu calls.
3. `Hi, show me burgers` is not treated as greeting-only.
4. A Vietnamese first message stores `vi`; later `Burger` receives a Vietnamese response.
5. An English first message stores `en`; later `Gà Yo` receives an English response.
6. A neutral first message defaults to `vi`.
7. Draft persistence restores `responseLanguage` after reconnect.
8. `Gà Yo đi` uniquely resolves Burger Gà Yo from stored suggestions without calling menu search.
9. Ordinal selection continues to resolve the correct suggestion.
10. An ambiguous `Gà` reply produces clarification and does not mutate draft items.
11. A name absent from suggestions falls back to menu search.
12. Existing negative-menu-preference and checkout tests continue passing.

## Out of Scope

- Explicit mid-session commands to change language.
- Translation of database product names.
- Fuzzy selection against products that were not shown to the user.
- Voice-call language negotiation; the persisted language field can be reused by the future voice channel.

