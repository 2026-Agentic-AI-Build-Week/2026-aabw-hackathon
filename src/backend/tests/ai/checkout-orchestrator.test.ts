import { describe, expect, it, vi } from "vitest";
import { CheckoutOrchestrator, CheckoutServiceError, type CheckoutGenerators, type OrderServicePort } from "../../src/ai/checkout-orchestrator.js";
import { createEmptyOrderDraft, type OrderDraft } from "../../src/ai/order-draft.js";
import { OrderError } from "../../src/orders/order-service.js";

const now = new Date("2026-07-12T10:00:00.000Z");

function draft(overrides: Partial<OrderDraft> = {}): OrderDraft {
  return {
    ...createEmptyOrderDraft(),
    items: [{ menuItemId: "zinger-1", name: "Zinger Burger", quantity: 2 }],
    delivery: {
      email: "customer@example.com",
      recipientName: "Alex Customer",
      phone: "0901234567",
      addressLine: "1 KFC Street",
      city: "Ho Chi Minh City",
    },
    ...overrides,
  };
}

function quoteResponse() {
  return {
    quote_id: "quote-1",
    subtotal: 110_000,
    discount_amount: 10_000,
    delivery_fee: 15_000,
    total: 115_000,
    currency: "VND",
    expires_at: "2026-07-12T10:15:00.000Z",
    confirmation_token: "server-secret-token",
    items: [{ menuItemId: "zinger-1", itemName: "Zinger Burger", quantity: 2, unitPrice: 55_000, modifierTotal: 0, lineTotal: 110_000 }],
  };
}

function createdOrder() {
  return {
    order: { id: "order-1", status: "CREATED" as const, total: 115_000, currency: "VND", createdAt: new Date("2026-07-12T10:01:00.000Z"), paymentQrCode: "KFCQR-DEMO" },
    created: true,
  };
}

function createOrderServicePort(): OrderServicePort {
  return {
    createQuote: vi.fn(async () => quoteResponse()),
    createOrder: vi.fn(async () => createdOrder()),
  };
}

const generators: CheckoutGenerators = {
  confirmationPhrase: () => "CONFIRM A1B2",
  idempotencyKey: () => "idempotency-key-1",
};

function orchestrator(orderService = createOrderServicePort(), injectedGenerators = generators) {
  return { orderService, instance: new CheckoutOrchestrator(orderService, () => now, injectedGenerators) };
}

describe("CheckoutOrchestrator.requestQuote", () => {
  it("rejects an empty cart without calling the order service", async () => {
    const { instance, orderService } = orchestrator();

    const result = await instance.requestQuote("user-1", "session-1", draft({ items: [] }));

    expect(result).toMatchObject({ errorCode: "EMPTY_CART", message: "Add at least one item before requesting a quote." });
    expect(orderService.createQuote).not.toHaveBeenCalled();
  });

  it("reports every required delivery field including email", async () => {
    const { instance } = orchestrator();

    const result = await instance.requestQuote("user-1", "session-1", draft({ delivery: { phone: "0901234567" } }));

    expect(result).toMatchObject({
      errorCode: "DELIVERY_INCOMPLETE",
      missingFields: ["email", "recipientName", "addressLine", "city"],
    });
  });

  it("maps a draft into a quote, retains the server token only in state, and emits a safe quote", async () => {
    const { instance, orderService } = orchestrator();

    const result = await instance.requestQuote("user-1", "session-1", draft({ voucherCode: "KFC10" }));

    expect(orderService.createQuote).toHaveBeenCalledTimes(1);
    expect(orderService.createQuote).toHaveBeenCalledWith("user-1", {
      sessionId: "session-1",
      items: [{ menuItemId: "zinger-1", quantity: 2, modifiers: [] }],
      voucherCode: "KFC10",
      delivery: {
        email: "customer@example.com",
        recipientName: "Alex Customer",
        phone: "0901234567",
        addressLine: "1 KFC Street",
        city: "Ho Chi Minh City",
      },
    });
    expect(result.event).toMatchObject({
      state: "quote_ready",
      quote: { quoteId: "quote-1", confirmationPhrase: "CONFIRM A1B2" },
    });
    expect(result.draft.pendingCheckout?.confirmationToken).toBe("server-secret-token");
    expect(result.draft.pendingCheckout?.idempotencyKey).toBe("idempotency-key-1");
    expect(JSON.stringify(result.event)).not.toContain("server-secret-token");
  });

  it.each([
    [new CheckoutServiceError("ITEM_UNAVAILABLE"), "ITEM_UNAVAILABLE"],
    [new CheckoutServiceError("MODIFIER_INVALID"), "MODIFIER_INVALID"],
    [new CheckoutServiceError("VOUCHER_INVALID"), "VOUCHER_INVALID"],
    [new CheckoutServiceError("SESSION_EXPIRED"), "SESSION_EXPIRED"],
  ])("returns an actionable safe error from a stable port code %#", async (error, errorCode) => {
    const orderService = createOrderServicePort();
    vi.mocked(orderService.createQuote).mockRejectedValueOnce(error);
    const { instance } = orchestrator(orderService);

    const result = await instance.requestQuote("user-1", "session-1", draft());

    expect(result).toMatchObject({ errorCode });
    expect(result.message).toEqual(expect.any(String));
    expect(result.draft.pendingCheckout).toBeNull();
  });

  it("does not classify a legacy generic validation error from its message text", async () => {
    const orderService = createOrderServicePort();
    vi.mocked(orderService.createQuote).mockRejectedValueOnce(new OrderError("VALIDATION_ERROR", "Voucher is invalid.", 400));
    const { instance } = orchestrator(orderService);

    const result = await instance.requestQuote("user-1", "session-1", draft());

    expect(result).toMatchObject({ errorCode: "ORDER_VALIDATION_FAILED" });
  });

  it("uses secure default generators when no deterministic generators are injected", async () => {
    const orderService = createOrderServicePort();
    const instance = new CheckoutOrchestrator(orderService, () => now);

    const result = await instance.requestQuote("user-1", "session-1", draft());

    expect(result.event).toMatchObject({
      state: "quote_ready",
      quote: { confirmationPhrase: expect.stringMatching(/^CONFIRM [A-F0-9]{4}$/) },
    });
    expect(result.draft.pendingCheckout?.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

describe("CheckoutOrchestrator.confirmOrder", () => {
  async function quotedDraft(): Promise<OrderDraft> {
    const { instance } = orchestrator();
    return (await instance.requestQuote("user-1", "session-1", draft())).draft;
  }

  it("rejects a confirmation when there is no pending quote", async () => {
    const { instance, orderService } = orchestrator();

    const result = await instance.confirmOrder("user-1", draft(), "CONFIRM TEST");

    expect(result).toMatchObject({ errorCode: "NO_PENDING_QUOTE" });
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it("requires the exact case-sensitive phrase after trimming outer whitespace only", async () => {
    const { instance, orderService } = orchestrator();
    const draftWithQuote = await quotedDraft();
    const phrase = draftWithQuote.pendingCheckout?.confirmationPhrase ?? "";

    const rejected = await instance.confirmOrder("user-1", draftWithQuote, "yes");
    const wrongCase = await instance.confirmOrder("user-1", draftWithQuote, phrase.toLowerCase());
    const accepted = await instance.confirmOrder("user-1", draftWithQuote, `  ${phrase}  `);

    expect(rejected).toMatchObject({ errorCode: "CONFIRMATION_MISMATCH" });
    expect(wrongCase).toMatchObject({ errorCode: "CONFIRMATION_MISMATCH" });
    expect(rejected.draft.pendingCheckout).toEqual(draftWithQuote.pendingCheckout);
    expect(accepted.event).toMatchObject({ state: "order_created", order: { orderId: "order-1", paymentQrCode: "KFCQR-DEMO" } });
    expect(accepted.draft.items).toEqual([]);
    expect(accepted.draft.suggestions).toEqual([]);
    expect(orderService.createOrder).toHaveBeenCalledWith("user-1", "quote-1", "server-secret-token", draftWithQuote.pendingCheckout?.idempotencyKey);
  });

  it("rejects an expired quote locally without consuming it", async () => {
    const { instance, orderService } = orchestrator();
    const draftWithQuote = await quotedDraft();
    const expired = { ...draftWithQuote, pendingCheckout: { ...draftWithQuote.pendingCheckout!, expiresAt: "2026-07-12T09:59:59.000Z" } };

    const result = await instance.confirmOrder("user-1", expired, expired.pendingCheckout.confirmationPhrase);

    expect(result).toMatchObject({ errorCode: "QUOTE_EXPIRED" });
    expect(result.draft.pendingCheckout).toEqual(expired.pendingCheckout);
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it("retains pending checkout after service failure and supports the same-key idempotent retry", async () => {
    const orderService = createOrderServicePort();
    vi.mocked(orderService.createOrder).mockRejectedValueOnce(new CheckoutServiceError("INSUFFICIENT_STOCK"));
    vi.mocked(orderService.createOrder).mockResolvedValueOnce({ ...createdOrder(), created: false });
    const { instance } = orchestrator(orderService);
    const draftWithQuote = await quotedDraft();
    const phrase = draftWithQuote.pendingCheckout?.confirmationPhrase ?? "";

    const failed = await instance.confirmOrder("user-1", draftWithQuote, phrase);
    const retried = await instance.confirmOrder("user-1", failed.draft, phrase);

    expect(failed).toMatchObject({ errorCode: "INSUFFICIENT_STOCK" });
    expect(failed.draft.pendingCheckout).toEqual(draftWithQuote.pendingCheckout);
    expect(retried.event).toMatchObject({ state: "order_created", order: { orderId: "order-1" } });
    expect(retried.draft.pendingCheckout).toBeNull();
    expect(orderService.createOrder).toHaveBeenNthCalledWith(1, "user-1", "quote-1", "server-secret-token", draftWithQuote.pendingCheckout?.idempotencyKey);
    expect(orderService.createOrder).toHaveBeenNthCalledWith(2, "user-1", "quote-1", "server-secret-token", draftWithQuote.pendingCheckout?.idempotencyKey);
    expect(JSON.stringify(retried.event)).not.toContain("server-secret-token");
  });

  it("accepts a replay of the same persisted pending checkout after a lost success response", async () => {
    const orderService = createOrderServicePort();
    vi.mocked(orderService.createOrder).mockResolvedValueOnce(createdOrder());
    vi.mocked(orderService.createOrder).mockResolvedValueOnce({ ...createdOrder(), created: false });
    const { instance } = orchestrator(orderService);
    const draftWithQuote = await quotedDraft();
    const phrase = draftWithQuote.pendingCheckout?.confirmationPhrase ?? "";

    const first = await instance.confirmOrder("user-1", draftWithQuote, phrase);
    const replay = await instance.confirmOrder("user-1", draftWithQuote, phrase);

    expect(first.event).toMatchObject({ state: "order_created", order: { orderId: "order-1" } });
    expect(replay.event).toMatchObject({ state: "order_created", order: { orderId: "order-1" } });
    expect(orderService.createOrder).toHaveBeenCalledTimes(2);
    expect(orderService.createOrder).toHaveBeenNthCalledWith(1, "user-1", "quote-1", "server-secret-token", "idempotency-key-1");
    expect(orderService.createOrder).toHaveBeenNthCalledWith(2, "user-1", "quote-1", "server-secret-token", "idempotency-key-1");
  });
});
