# Chat Order Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable authenticated users to build, quote, explicitly confirm, and create a real KFC order entirely through the realtime chat flow.

**Architecture:** Keep `OrderService` as the only source of truth for menu availability, pricing, quote expiry, stock, and order creation. Add a focused checkout orchestrator between the intent-driven `OrderingAgent` and `OrderService`; it stores sensitive quote confirmation state only on the backend and returns safe typed checkout events to the mobile client. Require an exact backend-generated confirmation phrase before creating an order, and reuse one idempotency key per pending checkout so retries cannot create duplicate orders.

**Tech Stack:** Node.js, TypeScript, Prisma/PostgreSQL, Socket.IO, Vitest, React Native/Expo, `socket.io-client`

---

## Current Gap

- `src/backend/src/orders/order-service.ts` already implements `createQuote` and idempotent `createOrder`.
- `src/backend/src/ai/ordering-agent.ts` currently stops after menu search and draft updates.
- `src/backend/src/ai/order-draft.ts` stores selected menu items but no delivery details or pending quote state.
- `src/backend/src/realtime/chat-events.ts` emits text, typing, and errors only; there is no typed quote or order event.
- The mobile conversation screen can display messages but has no quote summary or explicit order-confirmation control.

## File Structure

### Backend files to create

- `src/backend/src/ai/checkout-types.ts` — delivery, pending-checkout, safe quote, and created-order types.
- `src/backend/src/ai/checkout-orchestrator.ts` — translates a validated chat draft into `OrderService` quote/order calls.
- `src/backend/tests/ai/checkout-orchestrator.test.ts` — quote, confirmation, expiry, and idempotency tests.

### Backend files to modify

- `src/backend/src/ai/menu-intent.ts` — add checkout actions and structured delivery fields.
- `src/backend/src/ai/menu-intent-extractor.ts` — teach Qwen to extract delivery and confirmation intent.
- `src/backend/src/ai/order-draft.ts` — persist delivery and server-only pending checkout data.
- `src/backend/src/ai/prisma-order-draft-store.ts` — serialize the expanded draft safely.
- `src/backend/src/ai/ordering-agent.ts` — route search, draft, quote, and confirmation actions.
- `src/backend/src/ai/ai-client.ts` — return a structured agent result rather than text only.
- `src/backend/src/realtime/chat-events.ts` — add safe checkout payloads and protocol events.
- `src/backend/src/realtime/chat-handler.ts` — emit checkout state alongside the assistant response.
- `src/backend/src/server.ts` — construct and inject `CheckoutOrchestrator` and `OrderService`.
- `src/backend/tests/ai/menu-intent.test.ts` — cover checkout parsing.
- `src/backend/tests/ai/order-draft.test.ts` — cover delivery and pending checkout transitions.
- `src/backend/tests/ai/ordering-agent.test.ts` — cover action routing.
- `src/backend/tests/realtime/chat-handler.test.ts` — cover safe checkout events.

### Mobile files to create

- `src/frontend-mobile/components/CheckoutCard.tsx` — quote summary, expiry, and confirmation phrase UI.

### Mobile files to modify

- `src/frontend-mobile/models/chat.ts` — mirror safe checkout event types.
- `src/frontend-mobile/services/socketService.ts` — register typed checkout events.
- `src/frontend-mobile/hooks/useRealtimeChat.ts` — expose quote/order state to the screen.
- `src/frontend-mobile/pages/ChatConversationDetail.tsx` — render the checkout card without disrupting the inverted message list.
- `src/frontend-mobile/theme.ts` — add any missing checkout tokens rather than hard-coding styles.
- `src/frontend-mobile/README.md` — document the chat checkout lifecycle.

---

### Task 1: Define Checkout Intent and Socket Contracts

**Files:**
- Create: `src/backend/src/ai/checkout-types.ts`
- Modify: `src/backend/src/ai/menu-intent.ts`
- Modify: `src/backend/src/realtime/chat-events.ts`
- Test: `src/backend/tests/ai/menu-intent.test.ts`

- [ ] **Step 1: Write failing parser tests for checkout actions**

Add cases proving `parseMenuIntent` accepts `REMOVE_DRAFT_ITEM`, `COLLECT_DELIVERY`, `REQUEST_QUOTE`, and `CONFIRM_ORDER`, while rejecting malformed delivery values and falling back safely.

```ts
expect(parseMenuIntent({
  action: "COLLECT_DELIVERY",
  delivery: {
    recipient_name: "Taylor",
    phone: "0901234567",
    address_line: "1 Nguyen Hue",
    ward: "Ben Nghe",
    district: "District 1",
    city: "Ho Chi Minh City",
  },
})).toMatchObject({ action: "COLLECT_DELIVERY", delivery: { recipientName: "Taylor" } });
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm --prefix src/backend test -- tests/ai/menu-intent.test.ts`

Expected: FAIL because checkout actions and delivery parsing do not exist.

- [ ] **Step 3: Add explicit checkout domain types**

Define `DeliveryDraft`, `PendingCheckout`, `SafeQuote`, `SafeCreatedOrder`, and `CheckoutEvent` in `checkout-types.ts`. `PendingCheckout` must contain `confirmationToken` and remain backend-only; `SafeQuote` must expose `confirmationPhrase` but never the token.

```ts
export type PendingCheckout = {
  quoteId: string;
  confirmationToken: string;
  confirmationPhrase: string;
  expiresAt: string;
  idempotencyKey: string;
};

export type CheckoutEvent =
  | { state: "quote_ready"; quote: SafeQuote }
  | { state: "order_created"; order: SafeCreatedOrder };
```

- [ ] **Step 4: Extend the intent and Socket contracts**

Add checkout actions, optional delivery data, and an optional exact `confirmationPhrase` to `MenuIntent`. Add `checkout_update` to `ServerToClientEvents` with a payload containing `session_id` plus the safe `CheckoutEvent` union.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm --prefix src/backend test -- tests/ai/menu-intent.test.ts && npm --prefix src/backend run lint`

Expected: PASS.

- [ ] **Step 6: Commit the contract slice**

```bash
git add src/backend/src/ai/checkout-types.ts src/backend/src/ai/menu-intent.ts src/backend/src/realtime/chat-events.ts src/backend/tests/ai/menu-intent.test.ts
git commit -m "Define chat checkout contracts"
```

### Task 2: Persist Delivery and Pending Checkout State

**Files:**
- Modify: `src/backend/src/ai/order-draft.ts`
- Modify: `src/backend/src/ai/prisma-order-draft-store.ts`
- Test: `src/backend/tests/ai/order-draft.test.ts`

- [ ] **Step 1: Write failing draft transition tests**

Cover merging partial delivery fields, removing an item, invalidating an old pending quote whenever items/delivery change, and preserving `PendingCheckout` only when the draft is unchanged.

```ts
expect(updateOrderDraft(draftWithPendingQuote, collectDeliveryIntent, [])).toMatchObject({
  delivery: { recipientName: "Taylor" },
  pendingCheckout: null,
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm --prefix src/backend test -- tests/ai/order-draft.test.ts`

Expected: FAIL because the current draft contains only items, preferences, unresolved fields, and suggestions.

- [ ] **Step 3: Expand `OrderDraft` with safe state transitions**

Add `delivery`, `voucherCode`, and `pendingCheckout`. Split transitions into focused helpers such as `applyMenuSelection`, `applyDeliveryUpdate`, `removeDraftItem`, and `withPendingCheckout`. Any cart, voucher, or delivery mutation must set `pendingCheckout` to `null` because the previous quote is stale.

- [ ] **Step 4: Update Prisma draft serialization**

Store the expanded JSON in the existing conversation/session draft field. Parse unknown JSON defensively; invalid or legacy data must return an empty draft rather than crash a chat session.

- [ ] **Step 5: Run focused tests and lint**

Run: `npm --prefix src/backend test -- tests/ai/order-draft.test.ts && npm --prefix src/backend run lint`

Expected: PASS.

- [ ] **Step 6: Commit draft persistence**

```bash
git add src/backend/src/ai/order-draft.ts src/backend/src/ai/prisma-order-draft-store.ts src/backend/tests/ai/order-draft.test.ts
git commit -m "Persist chat checkout draft state"
```

### Task 3: Build the Quote Orchestrator

**Files:**
- Create: `src/backend/src/ai/checkout-orchestrator.ts`
- Test: `src/backend/tests/ai/checkout-orchestrator.test.ts`
- Reference: `src/backend/src/orders/order-input.ts`
- Reference: `src/backend/src/orders/order-service.ts`

- [ ] **Step 1: Write failing quote orchestration tests**

Use an `OrderServicePort` mock. Verify the orchestrator rejects an empty cart, reports exact missing delivery fields, maps draft items to `QuoteInput`, calls `createQuote` once, generates a short confirmation phrase such as `CONFIRM 7A2F`, and stores the raw token only in `PendingCheckout`.

```ts
expect(result.event).toMatchObject({
  state: "quote_ready",
  quote: { confirmationPhrase: expect.stringMatching(/^CONFIRM [A-Z0-9]{4}$/) },
});
expect(result.draft.pendingCheckout?.confirmationToken).toBe("server-secret-token");
expect(JSON.stringify(result.event)).not.toContain("server-secret-token");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm --prefix src/backend test -- tests/ai/checkout-orchestrator.test.ts`

Expected: FAIL because `CheckoutOrchestrator` does not exist.

- [ ] **Step 3: Implement `requestQuote` using `OrderService`**

Inject an interface exposing `createQuote` and `createOrder`. Validate the draft first, then map it to the existing `QuoteInput` shape. Generate `crypto.randomUUID()` once for `idempotencyKey`; never let the LLM invent quote IDs, totals, tokens, or order IDs.

- [ ] **Step 4: Translate known `OrderError` failures**

Return actionable English assistant messages for unavailable items, invalid modifiers, invalid vouchers, and expired sessions. Preserve stable machine error codes for Socket/mobile handling; do not leak stack traces or provider errors.

- [ ] **Step 5: Run focused tests and lint**

Run: `npm --prefix src/backend test -- tests/ai/checkout-orchestrator.test.ts && npm --prefix src/backend run lint`

Expected: PASS.

- [ ] **Step 6: Commit quote orchestration**

```bash
git add src/backend/src/ai/checkout-orchestrator.ts src/backend/tests/ai/checkout-orchestrator.test.ts
git commit -m "Add chat order quote orchestration"
```

### Task 4: Require Exact Confirmation and Create Orders Idempotently

**Files:**
- Modify: `src/backend/src/ai/checkout-orchestrator.ts`
- Test: `src/backend/tests/ai/checkout-orchestrator.test.ts`

- [ ] **Step 1: Write failing confirmation tests**

Cover: no pending quote, wrong phrase, expired quote, exact case-normalized phrase, successful order, repeated confirmation using the same idempotency key, and order-service rejection after stock changes.

```ts
await expect(orchestrator.confirmOrder(userId, draft, "CONFIRM 7A2F"))
  .resolves.toMatchObject({ event: { state: "order_created" } });
expect(orderService.createOrder).toHaveBeenCalledWith(
  userId,
  "quote-1",
  "server-secret-token",
  draft.pendingCheckout?.idempotencyKey,
);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm --prefix src/backend test -- tests/ai/checkout-orchestrator.test.ts`

Expected: FAIL because confirmation is not implemented.

- [ ] **Step 3: Implement exact confirmation**

Normalize surrounding whitespace and letter case only. Do not treat “yes”, “okay”, emoji, or an LLM classification as payment confirmation. Call `OrderService.createOrder` only when the normalized user message equals the stored phrase and the quote has not expired.

- [ ] **Step 4: Preserve retry safety**

Keep the same pending checkout and idempotency key until `createOrder` succeeds. Clear it only after a successful result. If the response is lost and the client retries, `OrderService` must return the existing order instead of creating a duplicate.

- [ ] **Step 5: Run focused tests and lint**

Run: `npm --prefix src/backend test -- tests/ai/checkout-orchestrator.test.ts && npm --prefix src/backend run lint`

Expected: PASS.

- [ ] **Step 6: Commit confirmation logic**

```bash
git add src/backend/src/ai/checkout-orchestrator.ts src/backend/tests/ai/checkout-orchestrator.test.ts
git commit -m "Require explicit chat order confirmation"
```

### Task 5: Route Qwen Intents Through the Checkout Flow

**Files:**
- Modify: `src/backend/src/ai/menu-intent-extractor.ts`
- Modify: `src/backend/src/ai/ai-client.ts`
- Modify: `src/backend/src/ai/ordering-agent.ts`
- Test: `src/backend/tests/ai/openai-ai-client.test.ts`
- Test: `src/backend/tests/ai/ordering-agent.test.ts`

- [ ] **Step 1: Write failing intent and routing tests**

Prove natural-language requests such as “checkout”, “deliver to…”, “remove the Pepsi”, and the exact confirmation phrase route to the correct deterministic action. Also prove ordinary “yes” never calls `createOrder`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm --prefix src/backend test -- tests/ai/openai-ai-client.test.ts tests/ai/ordering-agent.test.ts`

Expected: FAIL because the current action union and agent only support menu search.

- [ ] **Step 3: Update the Qwen extraction schema and prompt**

Describe each checkout action, require structured delivery fields, and state that `CONFIRM_ORDER` is selected only when the raw user text contains the active backend phrase. Continue using DashScope-compatible non-thinking tool mode for `qwen3.7-plus`.

- [ ] **Step 4: Return structured agent results**

Change `ChatAi.respond` from `Promise<string>` to a result containing `text` plus optional safe `checkoutEvent`. Keep search response generation separate from checkout orchestration. The agent loads the draft once, performs one action, saves the resulting draft once, and returns a user-facing response.

- [ ] **Step 5: Add deterministic confirmation interception**

Before asking Qwen to classify a message, compare the raw text with the stored pending confirmation phrase. This avoids model variability and prevents Qwen from blocking a valid confirmation.

- [ ] **Step 6: Run focused tests and lint**

Run: `npm --prefix src/backend test -- tests/ai/openai-ai-client.test.ts tests/ai/ordering-agent.test.ts && npm --prefix src/backend run lint`

Expected: PASS.

- [ ] **Step 7: Commit agent routing**

```bash
git add src/backend/src/ai/menu-intent-extractor.ts src/backend/src/ai/ai-client.ts src/backend/src/ai/ordering-agent.ts src/backend/tests/ai/openai-ai-client.test.ts src/backend/tests/ai/ordering-agent.test.ts
git commit -m "Route chat intents to order checkout"
```

### Task 6: Emit Safe Realtime Checkout Events

**Files:**
- Modify: `src/backend/src/realtime/chat-handler.ts`
- Modify: `src/backend/src/server.ts`
- Test: `src/backend/tests/realtime/chat-handler.test.ts`

- [ ] **Step 1: Write failing realtime tests**

Verify a quote response emits `ai_response` and `checkout_update`, an order response emits `order_created`, and neither payload contains `confirmationToken`. Verify failures still stop the typing indicator in `finally`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm --prefix src/backend test -- tests/realtime/chat-handler.test.ts`

Expected: FAIL because `ChatEmitter` has no checkout method.

- [ ] **Step 3: Emit checkout state from `ChatHandler`**

Persist the assistant text exactly as today, then emit the optional safe checkout event after `ai_response`. Add `checkout(payload)` to `ChatEmitter`; never serialize the backend draft or pending checkout directly.

- [ ] **Step 4: Wire dependencies in `server.ts`**

Construct one `OrderService`, inject it into `CheckoutOrchestrator`, inject the orchestrator into `OrderingAgent`, and map `ChatEmitter.checkout` to Socket.IO `checkout_update` for the authenticated session room.

- [ ] **Step 5: Run focused tests and lint**

Run: `npm --prefix src/backend test -- tests/realtime/chat-handler.test.ts && npm --prefix src/backend run lint`

Expected: PASS.

- [ ] **Step 6: Commit realtime integration**

```bash
git add src/backend/src/realtime/chat-handler.ts src/backend/src/server.ts src/backend/tests/realtime/chat-handler.test.ts
git commit -m "Emit realtime chat checkout updates"
```

### Task 7: Display Quote and Order State on Mobile

**Files:**
- Create: `src/frontend-mobile/components/CheckoutCard.tsx`
- Modify: `src/frontend-mobile/models/chat.ts`
- Modify: `src/frontend-mobile/services/socketService.ts`
- Modify: `src/frontend-mobile/hooks/useRealtimeChat.ts`
- Modify: `src/frontend-mobile/pages/ChatConversationDetail.tsx`
- Modify: `src/frontend-mobile/theme.ts`

- [ ] **Step 1: Add strict mobile checkout types**

Mirror only the safe Socket DTO. Do not define or accept `confirmationToken` on the client. Use a discriminated union for `quote_ready` and `order_created`.

- [ ] **Step 2: Subscribe and clean up the Socket event**

Add `checkout_update` to the typed Socket.IO event map. Register one listener when the hook mounts and remove the same listener on cleanup. Reset stale checkout state when the authenticated session changes.

- [ ] **Step 3: Expose checkout state from `useRealtimeChat`**

Return `checkout`, `isTyping`, `typingStage`, messages, and `sendMessage`. Keep the exact phrase visible and sendable as normal user text; do not add a client-side bypass that calls the REST order API directly.

- [ ] **Step 4: Add design tokens and `CheckoutCard`**

Add semantic colors, typography, spacing, and radii to `theme.ts` only where missing. Render line items, subtotal, discount, delivery fee, total, expiration, and the exact confirmation phrase. For `order_created`, render the order identifier and status. All styles must use tokens.

- [ ] **Step 5: Integrate the card responsively**

Place `CheckoutCard` between `ChatHeader` and the message list or as a non-inverted list header so it remains visible without covering the keyboard-safe input bar. Respect safe-area insets and existing Android navigation-bar handling.

- [ ] **Step 6: Run mobile verification**

Run: `npm --prefix src/frontend-mobile run typecheck`

Expected: PASS with no `any` and no missing token keys.

- [ ] **Step 7: Commit mobile checkout UI**

```bash
git add src/frontend-mobile/components/CheckoutCard.tsx src/frontend-mobile/models/chat.ts src/frontend-mobile/services/socketService.ts src/frontend-mobile/hooks/useRealtimeChat.ts src/frontend-mobile/pages/ChatConversationDetail.tsx src/frontend-mobile/theme.ts
git commit -m "Show chat order checkout state on mobile"
```

### Task 8: Document and Verify the Complete MVP Flow

**Files:**
- Modify: `src/frontend-mobile/README.md`
- Modify: `README.md`

- [ ] **Step 1: Document the user journey and security boundary**

Document: add items → collect delivery → request quote → show exact phrase → confirm → create order. State that AI provider keys and confirmation tokens remain backend-only, while the mobile app receives safe quote/order DTOs.

- [ ] **Step 2: Run all automated checks**

Run:

```bash
npm --prefix src/backend run db:generate
npm --prefix src/backend run lint
npm --prefix src/backend run test
npm --prefix src/frontend-mobile run typecheck
```

Expected: all commands PASS.

- [ ] **Step 3: Run the manual acceptance scenario**

1. Log in on mobile and open KFC Ordering Bot.
2. Send: `I want 2 pieces of fried chicken and one Pepsi.`
3. Select an offered item if clarification is required.
4. Send delivery details in one or multiple messages.
5. Send: `Checkout my order.`
6. Verify the UI shows server-calculated totals and `CONFIRM XXXX`.
7. Send `yes`; verify no order is created and the bot repeats the exact phrase requirement.
8. Send the exact phrase; verify one order is created and shown in the UI.
9. Retry the exact phrase; verify no duplicate order is created.
10. Check the database and confirm the order, items, delivery snapshot, and status history exist.

- [ ] **Step 4: Verify secrets never cross the Socket boundary**

Inspect Socket payloads in development logs or a Socket.IO test client. Confirm `confirmation_token`, `AI_API_KEY`, `DASHSCOPE_API_KEY`, and raw backend draft JSON never appear.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md src/frontend-mobile/README.md
git commit -m "Document chat order checkout flow"
```

---

## MVP Guardrails

- Do not let Qwen calculate prices, invent menu IDs, generate quote IDs, or create orders directly.
- Do not expose the REST confirmation token to React Native or put it in assistant text.
- Do not accept vague confirmation such as “yes”; require the exact active phrase.
- Do not create a second cart/order subsystem; reuse `OrderService` and its existing transaction and idempotency behavior.
- Do not add payment processing in this plan. The MVP ends at successful order creation and can add payment as a separate plan.
- Keep the checkout orchestrator transport-agnostic so a future Agora voice adapter can reuse the same draft, quote, and confirmation APIs.
