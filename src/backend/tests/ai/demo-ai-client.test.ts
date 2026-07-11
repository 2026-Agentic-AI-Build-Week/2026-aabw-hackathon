import { describe, expect, it } from "vitest";
import { DemoMenuIntentExtractor, DemoMenuResponder } from "../../src/ai/demo-ai-client.js";
import { OrderingAgent } from "../../src/ai/ordering-agent.js";
import { createEmptyOrderDraft } from "../../src/ai/order-draft.js";
import { CheckoutOrchestrator } from "../../src/ai/checkout-orchestrator.js";
import { vi } from "vitest";

const input = { userId: "user-1", sessionId: "session-1", history: [] as Array<{ sender: "user" | "bot"; text: string }> };

describe("demo ordering components", () => {
  it("extracts checkout, delivery, removal, and menu search intents deterministically", async () => {
    const extractor = new DemoMenuIntentExtractor();

    await expect(extractor.extract({ ...input, text: "checkout" })).resolves.toMatchObject({ action: "REQUEST_QUOTE" });
    await expect(extractor.extract({ ...input, text: "deliver to 1 Nguyen Hue, Ho Chi Minh City" })).resolves.toMatchObject({ action: "COLLECT_DELIVERY" });
    await expect(extractor.extract({ ...input, text: "remove Pepsi" })).resolves.toMatchObject({ action: "REMOVE_DRAFT_ITEM", foodQuery: "Pepsi" });
    await expect(extractor.extract({ ...input, text: "Cho tôi xem đơn hàng hiện tại" })).resolves.toMatchObject({ action: "VIEW_DRAFT" });
    await expect(extractor.extract({ ...input, text: "chicken wings" })).resolves.toMatchObject({ action: "SEARCH_ITEM", foodQuery: "chicken wings" });
  });

  it.each([
    ["email is guest@example.com", { email: "guest@example.com" }],
    ["my name is Taylor Nguyen", { recipientName: "Taylor Nguyen" }],
    ["phone 0901234567", { phone: "0901234567" }],
    ["address is 1 Nguyen Hue", { addressLine: "1 Nguyen Hue" }],
    ["city is Ho Chi Minh City", { city: "Ho Chi Minh City" }],
    ["ward Ben Nghe", { ward: "Ben Nghe" }],
    ["district 1", { district: "1" }],
  ])("extracts a partial delivery follow-up: %s", async (text, delivery) => {
    await expect(new DemoMenuIntentExtractor().extract({ ...input, text })).resolves.toMatchObject({ action: "COLLECT_DELIVERY", delivery });
  });

  it("responds as a menu responder without bypassing the ordering agent", async () => {
    const responder = new DemoMenuResponder();
    await expect(responder.generate({ ...input, text: "chicken" }, { action: "SEARCH_ITEM", foodQuery: "chicken", categoryQuery: null, itemType: null, quantity: null, preferences: [], preferenceUpdates: { excludeItemTypes: [], includeItemTypes: [] }, referencedSelection: null, delivery: null, confirmationPhrase: null, needsClarification: false, clarificationQuestion: null }, [])).resolves.toContain("KFC demo assistant");
  });

  it("routes demo checkout through the same draft and checkout orchestrator flow", async () => {
    const draft = createEmptyOrderDraft();
    const quotedDraft = { ...draft, pendingCheckout: { quoteId: "quote-1", confirmationToken: "secret", confirmationPhrase: "CONFIRM DEMO", expiresAt: "2026-07-12T12:30:00.000Z", idempotencyKey: "key-1" } };
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn().mockResolvedValue(undefined) };
    const checkout = { requestQuote: vi.fn().mockResolvedValue({ draft: quotedDraft, event: { state: "quote_ready" as const, quote: { quoteId: "quote-1", subtotal: 1, discountAmount: 0, deliveryFee: 0, total: 1, currency: "VND", expiresAt: "2026-07-12T12:30:00.000Z", confirmationPhrase: "CONFIRM DEMO", items: [] } } }), confirmOrder: vi.fn() };
    const search = { browse: vi.fn(), searchCategories: vi.fn(), search: vi.fn() };
    const agent = new OrderingAgent(new DemoMenuIntentExtractor(), search, new DemoMenuResponder(), drafts, checkout);

    const result = await agent.respond({ ...input, text: "checkout" });

    expect(checkout.requestQuote).toHaveBeenCalledWith("user-1", "session-1", draft);
    expect(drafts.load).toHaveBeenCalledTimes(1);
    expect(drafts.save).toHaveBeenCalledTimes(1);
    expect(result.checkoutEvent?.state).toBe("quote_ready");
  });

  it("creates a demo quote and confirms it through the real checkout orchestrator", async () => {
    let storedDraft = {
      ...createEmptyOrderDraft(),
      items: [{ menuItemId: "item-1", name: "Chicken Combo", quantity: 1 }],
      delivery: { email: "guest@example.com", recipientName: "Taylor", phone: "0901234567", addressLine: "1 Nguyen Hue", city: "Ho Chi Minh City" },
    };
    const drafts = { load: vi.fn(async () => storedDraft), save: vi.fn(async (_sessionId: string, draft: typeof storedDraft) => { storedDraft = draft; }) };
    const orderService = {
      createQuote: vi.fn().mockResolvedValue({ quote_id: "quote-1", subtotal: 100000, discount_amount: 0, delivery_fee: 0, total: 100000, currency: "VND", expires_at: "2026-07-12T12:30:00.000Z", confirmation_token: "server-secret", items: [{ menuItemId: "item-1", itemName: "Chicken Combo", quantity: 1, unitPrice: 100000, modifierTotal: 0, lineTotal: 100000 }] }),
      createOrder: vi.fn().mockResolvedValue({ created: true, order: { id: "order-1", status: "CREATED", total: 100000, currency: "VND", createdAt: new Date("2026-07-12T12:01:00.000Z") } }),
    };
    const checkout = new CheckoutOrchestrator(orderService, () => new Date("2026-07-12T12:00:00.000Z"), { confirmationPhrase: () => "CONFIRM DEMO", idempotencyKey: () => "key-1" });
    const search = { browse: vi.fn(), searchCategories: vi.fn(), search: vi.fn() };
    const agent = new OrderingAgent(new DemoMenuIntentExtractor(), search, new DemoMenuResponder(), drafts, checkout);

    const quote = await agent.respond({ ...input, text: "checkout" });
    const order = await agent.respond({ ...input, text: " CONFIRM DEMO " });

    expect(quote.checkoutEvent?.state).toBe("quote_ready");
    expect(order.checkoutEvent?.state).toBe("order_created");
    expect(orderService.createOrder).toHaveBeenCalledWith("user-1", "quote-1", "server-secret", "key-1");
  });
});
