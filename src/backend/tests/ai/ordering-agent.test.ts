import { describe, expect, it, vi } from "vitest";
import { OrderingAgent } from "../../src/ai/ordering-agent.js";
import { createEmptyOrderDraft } from "../../src/ai/order-draft.js";

describe("OrderingAgent", () => {
  it("persists a preference-only exclusion without searching the menu", async () => {
    const draft = {
      ...createEmptyOrderDraft(),
      items: [{ menuItemId: "item-1", name: "Tender", quantity: 2 }],
      pendingCheckout: {
        quoteId: "quote-1",
        confirmationToken: "secret-token",
        confirmationPhrase: "CONFIRM 7A2F",
        expiresAt: "2026-07-12T12:30:00.000Z",
        idempotencyKey: "idempotency-1",
      },
    };
    const extractor = {
      extract: vi.fn().mockResolvedValue({
        ...createIntent("UPDATE_PREFERENCES"),
        preferenceUpdates: { excludeItemTypes: ["combo"], includeItemTypes: [] },
      }),
    };
    const search = createSearch();
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn().mockResolvedValue(undefined) };
    const agent = new OrderingAgent(extractor, search, createResponder(), drafts);

    const result = await agent.respond({ userId: "user-1", sessionId: "session-1", text: "Tôi không ăn combo", history: [] });

    expect(search.browse).not.toHaveBeenCalled();
    expect(search.search).not.toHaveBeenCalled();
    expect(drafts.save).toHaveBeenCalledWith("session-1", expect.objectContaining({
      items: draft.items,
      menuPreferences: { excludedItemTypes: ["combo"] },
      pendingCheckout: null,
    }));
    expect(result.text).toBe("Mình đã ghi nhớ bạn không muốn combo. Bạn muốn xem món lẻ loại nào: burger, gà, cơm hay món ăn kèm?");
  });

  it("clarifies an empty preference update without saving or searching", async () => {
    const extractor = {
      extract: vi.fn().mockResolvedValue({
        ...createIntent("UPDATE_PREFERENCES"),
        preferenceUpdates: { excludeItemTypes: [], includeItemTypes: [] },
      }),
    };
    const search = createSearch();
    const drafts = { load: vi.fn().mockResolvedValue(createEmptyOrderDraft()), save: vi.fn() };
    const agent = new OrderingAgent(extractor, search, createResponder(), drafts);

    const result = await agent.respond({ userId: "user-1", sessionId: "session-1", text: "Tôi không ăn món đó", history: [] });

    expect(search.browse).not.toHaveBeenCalled();
    expect(search.search).not.toHaveBeenCalled();
    expect(drafts.save).not.toHaveBeenCalled();
    expect(result.text).toMatch(/muốn tránh|muốn loại trừ|không muốn|nói rõ/iu);
  });

  it("passes persisted exclusions to later browse and search operations", async () => {
    const draft = {
      ...createEmptyOrderDraft(),
      menuPreferences: { excludedItemTypes: ["combo"] },
    };
    const search = createSearch();
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn().mockResolvedValue(undefined) };
    const browseAgent = new OrderingAgent(
      { extract: vi.fn().mockResolvedValue(createIntent("BROWSE_MENU")) },
      search,
      createResponder(),
      drafts,
    );

    await browseAgent.respond({ userId: "user-1", sessionId: "session-1", text: "Xem menu", history: [] });

    expect(search.browse).toHaveBeenCalledWith(8, { excludedItemTypes: ["combo"] });

    search.browse.mockClear();
    const searchAgent = new OrderingAgent(
      { extract: vi.fn().mockResolvedValue({ ...createIntent("SEARCH_ITEM"), foodQuery: "burger" }) },
      search,
      createResponder(),
      drafts,
    );

    await searchAgent.respond({ userId: "user-1", sessionId: "session-1", text: "Cho xem burger", history: [] });

    expect(search.search).toHaveBeenCalledWith(expect.objectContaining({
      query: "burger",
      excludedItemTypes: ["combo"],
    }));
  });

  it("re-includes combo and removes the persisted exclusion", async () => {
    const draft = {
      ...createEmptyOrderDraft(),
      menuPreferences: { excludedItemTypes: ["combo", "drink"] },
    };
    const extractor = {
      extract: vi.fn().mockResolvedValue({
        ...createIntent("UPDATE_PREFERENCES"),
        preferenceUpdates: { excludeItemTypes: [], includeItemTypes: ["combo"] },
      }),
    };
    const search = createSearch();
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn().mockResolvedValue(undefined) };
    const agent = new OrderingAgent(extractor, search, createResponder(), drafts);

    await agent.respond({ userId: "user-1", sessionId: "session-1", text: "Cho tôi xem combo lại", history: [] });

    expect(search.browse).not.toHaveBeenCalled();
    expect(search.search).not.toHaveBeenCalled();
    expect(drafts.save).toHaveBeenCalledWith("session-1", expect.objectContaining({
      menuPreferences: { excludedItemTypes: ["drink"] },
    }));
  });

  it("describes empty filtered results as preference mismatch rather than sold out", async () => {
    const draft = {
      ...createEmptyOrderDraft(),
      menuPreferences: { excludedItemTypes: ["combo"] },
    };
    const search = createSearch();
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn().mockResolvedValue(undefined) };
    const responder = { generate: vi.fn().mockResolvedValue("Không có món nào phù hợp với sở thích hiện tại của bạn.") };
    const agent = new OrderingAgent(
      { extract: vi.fn().mockResolvedValue(createIntent("BROWSE_MENU")) },
      search,
      responder,
      drafts,
    );

    const result = await agent.respond({ userId: "user-1", sessionId: "session-1", text: "Xem menu", history: [] });

    expect(result.text.toLocaleLowerCase()).toContain("sở thích hiện tại");
    expect(result.text.toLocaleLowerCase()).not.toMatch(/hết hàng|sold out/u);
  });

  it("intercepts the exact pending confirmation phrase before calling the extractor", async () => {
    const draft = {
      ...createEmptyOrderDraft(),
      pendingCheckout: {
        quoteId: "quote-1",
        confirmationToken: "server-secret",
        confirmationPhrase: "CONFIRM 7A2F",
        expiresAt: "2026-07-12T12:30:00.000Z",
        idempotencyKey: "idempotency-1",
      },
    };
    const extractor = { extract: vi.fn() };
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn().mockResolvedValue(undefined) };
    const checkout = { requestQuote: vi.fn(), confirmOrder: vi.fn().mockResolvedValue({ draft: { ...draft, pendingCheckout: null }, event: { state: "order_created", order: { orderId: "order-1", status: "CREATED", total: 100000, currency: "VND", createdAt: "2026-07-12T12:00:00.000Z" } } }) };
    const responder = createResponder();
    const agent = new OrderingAgent(extractor, createSearch(), responder, drafts, checkout);

    const result = await agent.respond({ userId: "user-1", sessionId: "session-1", text: "  CONFIRM 7A2F  ", history: [] });

    expect(extractor.extract).not.toHaveBeenCalled();
    expect(checkout.confirmOrder).toHaveBeenCalledWith("user-1", draft, "CONFIRM 7A2F");
    expect(drafts.save).toHaveBeenCalledTimes(1);
    expect(result.checkoutEvent?.state).toBe("order_created");
  });

  it("routes quote requests through checkout and saves the resulting draft once", async () => {
    const draft = createEmptyOrderDraft();
    const quotedDraft = { ...draft, pendingCheckout: { quoteId: "quote-1", confirmationToken: "secret", confirmationPhrase: "CONFIRM ABCD", expiresAt: "2026-07-12T12:30:00.000Z", idempotencyKey: "key-1" } };
    const extractor = { extract: vi.fn().mockResolvedValue(createIntent("REQUEST_QUOTE")) };
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn().mockResolvedValue(undefined) };
    const checkout = { requestQuote: vi.fn().mockResolvedValue({ draft: quotedDraft, event: { state: "quote_ready", quote: { quoteId: "quote-1", subtotal: 90000, discountAmount: 0, deliveryFee: 10000, total: 100000, currency: "VND", expiresAt: "2026-07-12T12:30:00.000Z", confirmationPhrase: "CONFIRM ABCD", items: [] } } }), confirmOrder: vi.fn() };
    const responder = createResponder();
    const agent = new OrderingAgent(extractor, createSearch(), responder, drafts, checkout);

    const result = await agent.respond({ userId: "user-1", sessionId: "session-1", text: "checkout", history: [] });

    expect(checkout.requestQuote).toHaveBeenCalledWith("user-1", "session-1", draft);
    expect(drafts.save).toHaveBeenCalledTimes(1);
    expect(result.checkoutEvent?.state).toBe("quote_ready");
  });

  it("creates a server quote after a comma-separated Vietnamese delivery reply completes an order", async () => {
    const draft = {
      ...createEmptyOrderDraft(),
      items: [{ menuItemId: "item-1", name: "Tender", quantity: 1 }],
    };
    const quotedDraft = { ...draft, delivery: { email: "letrungkienthd@gmail.com", recipientName: "Lê Trung Kiên", phone: "0356988346", addressLine: "85/19 Trần Đình Xu", city: "Hồ Chí Minh" }, pendingCheckout: { quoteId: "quote-1", confirmationToken: "secret", confirmationPhrase: "CONFIRM A1B2", expiresAt: "2026-07-12T12:30:00.000Z", idempotencyKey: "key-1" } };
    const extractor = { extract: vi.fn().mockResolvedValue({ ...createIntent("COLLECT_DELIVERY"), delivery: { email: "letrungkienthd@gmail.com", phone: "0356988346" } }) };
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn().mockResolvedValue(undefined) };
    const checkout = { requestQuote: vi.fn().mockResolvedValue({ draft: quotedDraft, event: { state: "quote_ready" as const, quote: { quoteId: "quote-1", subtotal: 68000, discountAmount: 0, deliveryFee: 0, total: 68000, currency: "VND", expiresAt: "2026-07-12T12:30:00.000Z", confirmationPhrase: "CONFIRM A1B2", items: [] } } }), confirmOrder: vi.fn() };
    const agent = new OrderingAgent(extractor, createSearch(), createResponder(), drafts, checkout);

    const result = await agent.respond({ userId: "user-1", sessionId: "session-1", text: "letrungkienthd@gmail.com, Lê Trung Kiên, 0356988346, 85/19 Trần Đình Xu, Hồ Chí Minh", history: [] });

    expect(checkout.requestQuote).toHaveBeenCalledWith("user-1", "session-1", expect.objectContaining({
      delivery: { email: "letrungkienthd@gmail.com", recipientName: "Lê Trung Kiên", phone: "0356988346", addressLine: "85/19 Trần Đình Xu", city: "Hồ Chí Minh" },
    }));
    expect(result.checkoutEvent?.state).toBe("quote_ready");
  });

  it("treats a generic approval as a quote request when a complete draft has no active quote", async () => {
    const draft = {
      ...createEmptyOrderDraft(),
      items: [{ menuItemId: "item-1", name: "Tender", quantity: 1 }],
      delivery: { email: "guest@example.com", recipientName: "Taylor", phone: "0901234567", addressLine: "1 Nguyen Hue", city: "Ho Chi Minh City" },
    };
    const extractor = { extract: vi.fn().mockResolvedValue(createIntent("ASK_CLARIFICATION")) };
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn().mockResolvedValue(undefined) };
    const checkout = { requestQuote: vi.fn().mockResolvedValue({ draft, message: "Quote is ready." }), confirmOrder: vi.fn() };
    const agent = new OrderingAgent(extractor, createSearch(), createResponder(), drafts, checkout);

    await agent.respond({ userId: "user-1", sessionId: "session-1", text: "Xác nhận", history: [] });

    expect(checkout.requestQuote).toHaveBeenCalledWith("user-1", "session-1", draft);
    expect(checkout.confirmOrder).not.toHaveBeenCalled();
  });

  it.each(["Cho tôi xem đơn hàng hiện tại", "Hiện tại tôi đã chọn món gì"])("shows the current draft without browsing the menu: %s", async (text) => {
    const draft = {
      ...createEmptyOrderDraft(),
      items: [{ menuItemId: "item-1", name: "Burger Tôm", quantity: 1 }],
    };
    const extractor = { extract: vi.fn().mockResolvedValue(createIntent("VIEW_DRAFT")) };
    const search = createSearch();
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn() };
    const agent = new OrderingAgent(extractor, search, createResponder(), drafts, { requestQuote: vi.fn(), confirmOrder: vi.fn() });

    const result = await agent.respond({ userId: "user-1", sessionId: "session-1", text, history: [] });

    expect(result.text).toContain("1 x Burger Tôm");
    expect(search.browse).not.toHaveBeenCalled();
    expect(search.search).not.toHaveBeenCalled();
    expect(drafts.save).not.toHaveBeenCalled();
  });

  it("explains when the current draft is empty", async () => {
    const draft = createEmptyOrderDraft();
    const extractor = { extract: vi.fn().mockResolvedValue(createIntent("VIEW_DRAFT")) };
    const agent = new OrderingAgent(extractor, createSearch(), createResponder(), { load: vi.fn().mockResolvedValue(draft), save: vi.fn() });

    const result = await agent.respond({ userId: "user-1", sessionId: "session-1", text: "Show my current order", history: [] });

    expect(result.text).toContain("chưa có món nào");
  });

  it("does not treat an ordinary yes as order confirmation", async () => {
    const draft = { ...createEmptyOrderDraft(), pendingCheckout: { quoteId: "quote-1", confirmationToken: "secret", confirmationPhrase: "CONFIRM ABCD", expiresAt: "2026-07-12T12:30:00.000Z", idempotencyKey: "key-1" } };
    const extractor = { extract: vi.fn().mockResolvedValue(createIntent("ASK_CLARIFICATION")) };
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn().mockResolvedValue(undefined) };
    const checkout = { requestQuote: vi.fn(), confirmOrder: vi.fn() };
    const agent = new OrderingAgent(extractor, createSearch(), createResponder(), drafts, checkout);

    await agent.respond({ userId: "user-1", sessionId: "session-1", text: "yes", history: [] });

    expect(checkout.confirmOrder).not.toHaveBeenCalled();
  });

  it.each([
    ["COLLECT_DELIVERY", { delivery: { email: "guest@example.com" } }],
    ["REMOVE_DRAFT_ITEM", { foodQuery: "Pepsi" }],
  ])("loads and saves exactly once for %s", async (action, fields) => {
    const draft = createEmptyOrderDraft();
    const extractor = { extract: vi.fn().mockResolvedValue({ ...createIntent(action), ...fields }) };
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn().mockResolvedValue(undefined) };
    const agent = new OrderingAgent(extractor, createSearch(), createResponder(), drafts, { requestQuote: vi.fn(), confirmOrder: vi.fn() });

    await agent.respond({ userId: "user-1", sessionId: "session-1", text: action, history: [] });

    expect(drafts.load).toHaveBeenCalledTimes(1);
    expect(drafts.save).toHaveBeenCalledTimes(1);
  });

  it("uses outer-trim-only case-sensitive confirmation matching", async () => {
    const draft = { ...createEmptyOrderDraft(), pendingCheckout: { quoteId: "quote-1", confirmationToken: "secret", confirmationPhrase: "CONFIRM ABCD", expiresAt: "2026-07-12T12:30:00.000Z", idempotencyKey: "key-1" } };
    const extractor = { extract: vi.fn().mockResolvedValue(createIntent("ASK_CLARIFICATION")) };
    const checkout = { requestQuote: vi.fn(), confirmOrder: vi.fn() };
    const drafts = { load: vi.fn().mockResolvedValue(draft), save: vi.fn() };
    const agent = new OrderingAgent(extractor, createSearch(), createResponder(), drafts, checkout);

    await agent.respond({ userId: "user-1", sessionId: "session-1", text: " confirm abcd ", history: [] });

    expect(extractor.extract).toHaveBeenCalledTimes(1);
    expect(checkout.confirmOrder).not.toHaveBeenCalled();
  });
  it("searches categories then persists a validated draft", async () => {
    const extractor = { extract: vi.fn().mockResolvedValue({ action: "SEARCH_ITEM", foodQuery: "tender", categoryQuery: "fried chicken", itemType: null, quantity: 2, preferences: [], preferenceUpdates: { excludeItemTypes: [], includeItemTypes: [] }, referencedSelection: null, needsClarification: false, clarificationQuestion: null }) };
    const search = { browse: vi.fn(), searchCategories: vi.fn().mockResolvedValue([{ id: "category-1", name: "Fried Chicken", slug: "fried-chicken", score: 1 }]), search: vi.fn().mockResolvedValue([{ id: "item-1", name: "Tender", slug: "tender", itemType: "single", description: null, price: 1, currency: "VND", categories: [], score: 1 }]) };
    const drafts = { load: vi.fn().mockResolvedValue(createEmptyOrderDraft()), save: vi.fn().mockResolvedValue(undefined) };
    const responder = { generate: vi.fn().mockResolvedValue("Tender is available") };
    const agent = new OrderingAgent(extractor, search, responder, drafts);
    await agent.respond({ userId: "user-1", sessionId: "session-1", text: "2 tenders", history: [] });
    expect(search.search).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: ["category-1"], query: "tender" }));
    expect(drafts.save).toHaveBeenCalledWith("session-1", expect.objectContaining({ items: [{ menuItemId: "item-1", name: "Tender", quantity: 2 }] }));
  });

  it("uses featured menu items for broad browse intent", async () => {
    const featured = [{ id: "item-1", name: "Combo", slug: "combo", itemType: "combo", description: null, price: 1, currency: "VND", categories: [], score: 1 }];
    const extractor = { extract: vi.fn().mockResolvedValue({ action: "BROWSE_MENU", foodQuery: null, categoryQuery: null, itemType: null, quantity: null, preferences: [], preferenceUpdates: { excludeItemTypes: [], includeItemTypes: [] }, referencedSelection: null, needsClarification: false, clarificationQuestion: null }) };
    const search = { browse: vi.fn().mockResolvedValue(featured), searchCategories: vi.fn(), search: vi.fn() };
    const responder = { generate: vi.fn().mockResolvedValue("Try this combo") };
    const agent = new OrderingAgent(extractor, search, responder);
    await agent.respond({ userId: "user-1", sessionId: "session-1", text: "Tôi chưa biết ăn gì", history: [] });
    expect(search.browse).toHaveBeenCalledWith(8, { excludedItemTypes: [] });
    expect(search.search).not.toHaveBeenCalled();
    expect(responder.generate).toHaveBeenCalledWith(expect.anything(), expect.anything(), featured);
  });

  it("resolves an ordinal reply from persisted suggestions without searching again", async () => {
    const suggestion = { id: "item-1", name: "Tender", slug: "tender", itemType: "single", description: null, price: 1, currency: "VND", categories: [], score: 1 };
    const extractor = { extract: vi.fn().mockResolvedValue({ action: "REFINE_SELECTION", foodQuery: null, categoryQuery: null, itemType: null, quantity: null, preferences: [], preferenceUpdates: { excludeItemTypes: [], includeItemTypes: [] }, referencedSelection: "CURRENT", needsClarification: false, clarificationQuestion: null }) };
    const search = { browse: vi.fn(), searchCategories: vi.fn().mockResolvedValue([]), search: vi.fn() };
    const drafts = { load: vi.fn().mockResolvedValue({ ...createEmptyOrderDraft(), suggestions: [suggestion] }), save: vi.fn() };
    const responder = { generate: vi.fn().mockResolvedValue("Selected Tender") };
    const agent = new OrderingAgent(extractor, search, responder, drafts);
    await agent.respond({ userId: "user-1", sessionId: "session-1", text: "1 đi", history: [] });
    expect(search.search).not.toHaveBeenCalled();
    expect(responder.generate).toHaveBeenCalledWith(expect.anything(), expect.anything(), [suggestion]);
  });
});

function createIntent(action: string) {
  return { action, foodQuery: null, categoryQuery: null, itemType: null, quantity: null, preferences: [], preferenceUpdates: { excludeItemTypes: [], includeItemTypes: [] }, referencedSelection: null, delivery: null, confirmationPhrase: null, needsClarification: false, clarificationQuestion: null };
}

function createSearch() {
  return { browse: vi.fn().mockResolvedValue([]), searchCategories: vi.fn().mockResolvedValue([]), search: vi.fn().mockResolvedValue([]) };
}

function createResponder() {
  return { generate: vi.fn().mockResolvedValue("Okay") };
}
