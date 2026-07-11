import { describe, expect, it } from "vitest";
import type { PendingCheckout } from "../../src/ai/checkout-types.js";
import {
  applyDeliveryUpdate,
  applyMenuSelection,
  applyVoucherCode,
  createEmptyOrderDraft,
  removeDraftItem,
  updateOrderDraft,
  withPendingCheckout,
  withResponseLanguage,
  type OrderDraft,
} from "../../src/ai/order-draft.js";

const suggestion = {
  id: "item-1",
  name: "Tender",
  slug: "tender",
  itemType: "single",
  description: null,
  price: 1,
  currency: "VND",
  categories: [],
  score: 1,
};

const pendingCheckout: PendingCheckout = {
  quoteId: "quote-1",
  confirmationToken: "secret-token",
  confirmationPhrase: "CONFIRM 7A2F",
  expiresAt: "2026-07-12T12:00:00.000Z",
  idempotencyKey: "checkout-1",
};

function draft(overrides: Partial<OrderDraft> = {}): OrderDraft {
  return {
    ...createEmptyOrderDraft(),
    items: [{ menuItemId: "item-1", name: "Tender", quantity: 1 }],
    ...overrides,
  };
}

describe("order draft transitions", () => {
  it("starts without a response language", () => {
    expect(createEmptyOrderDraft().responseLanguage).toBeNull();
  });

  it("initializes the response language only once", () => {
    const initialized = withResponseLanguage(createEmptyOrderDraft(), "vi");

    expect(initialized).toMatchObject({ responseLanguage: "vi" });
    expect(withResponseLanguage({ ...initialized, responseLanguage: "en" }, "vi").responseLanguage).toBe("en");
  });

  it("starts with no excluded menu item types", () => {
    expect(createEmptyOrderDraft().menuPreferences).toEqual({ excludedItemTypes: [] });
  });

  it("applies exclusions while preserving cart data and invalidating checkout", () => {
    const source = draft({
      delivery: { recipientName: "Taylor", city: "Ho Chi Minh City" },
      pendingCheckout,
      suggestions: [suggestion],
    });

    const next = updateOrderDraft(source, {
      action: "UPDATE_PREFERENCES",
      foodQuery: null,
      categoryQuery: null,
      itemType: null,
      quantity: null,
      preferences: [],
      preferenceUpdates: { excludeItemTypes: ["combo"], includeItemTypes: [] },
      referencedSelection: null,
      delivery: null,
      confirmationPhrase: null,
      needsClarification: false,
      clarificationQuestion: null,
    }, []);

    expect(next).toMatchObject({
      items: source.items,
      delivery: source.delivery,
      suggestions: source.suggestions,
      menuPreferences: { excludedItemTypes: ["combo"] },
      pendingCheckout: null,
    });
    expect(source.menuPreferences).toEqual({ excludedItemTypes: [] });
  });

  it("removes explicitly included item types before adding exclusions", () => {
    const source = draft({
      menuPreferences: { excludedItemTypes: ["combo", "drink"] },
      pendingCheckout,
    });

    const next = updateOrderDraft(source, {
      action: "UPDATE_PREFERENCES",
      foodQuery: null,
      categoryQuery: null,
      itemType: null,
      quantity: null,
      preferences: [],
      preferenceUpdates: { excludeItemTypes: ["food"], includeItemTypes: ["combo"] },
      referencedSelection: null,
      delivery: null,
      confirmationPhrase: null,
      needsClarification: false,
      clarificationQuestion: null,
    }, []);

    expect(next.menuPreferences.excludedItemTypes).toEqual(["drink", "food"]);
    expect(next.pendingCheckout).toBeNull();
  });

  it("adds a validated selected item and updates its quantity without mutating the source", () => {
    const source = createEmptyOrderDraft();
    const next = applyMenuSelection(source, suggestion, 2, []);

    expect(next.items).toEqual([{ menuItemId: "item-1", name: "Tender", quantity: 2, unitPrice: 1, currency: "VND" }]);
    expect(source).toEqual(createEmptyOrderDraft());
  });

  it("preserves ordinal suggestion behavior", () => {
    const source = draft({ items: [], suggestions: [suggestion] });
    const next = updateOrderDraft(source, {
      action: "REFINE_SELECTION",
      foodQuery: null,
      categoryQuery: null,
      itemType: null,
      quantity: null,
      preferences: [],
      preferenceUpdates: { excludeItemTypes: [], includeItemTypes: [] },
      referencedSelection: "CURRENT",
      delivery: null,
      confirmationPhrase: null,
      needsClarification: false,
      clarificationQuestion: null,
    }, [suggestion]);

    expect(next.items).toEqual([{ menuItemId: "item-1", name: "Tender", quantity: 1, unitPrice: 1, currency: "VND" }]);
  });

  it("merges partial delivery fields and invalidates a stale quote", () => {
    const source = draft({
      delivery: { recipientName: "Taylor", city: "Ho Chi Minh City" },
      pendingCheckout,
    });

    const next = applyDeliveryUpdate(source, { phone: "0900000000", city: "Da Nang" });

    expect(next.delivery).toEqual({
      recipientName: "Taylor",
      phone: "0900000000",
      city: "Da Nang",
    });
    expect(next.pendingCheckout).toBeNull();
    expect(source.pendingCheckout).toEqual(pendingCheckout);
  });

  it("removes only the selected item and invalidates a stale quote", () => {
    const source = draft({
      items: [
        { menuItemId: "item-1", name: "Tender", quantity: 1 },
        { menuItemId: "item-2", name: "Pepsi", quantity: 2 },
      ],
      pendingCheckout,
    });

    const next = removeDraftItem(source, "item-1");

    expect(next.items).toEqual([{ menuItemId: "item-2", name: "Pepsi", quantity: 2 }]);
    expect(next.pendingCheckout).toBeNull();
    expect(source.items).toHaveLength(2);
  });

  it("preserves pending checkout when item removal changes nothing", () => {
    const source = draft({ pendingCheckout });

    const next = removeDraftItem(source, "missing-item");

    expect(next).toBe(source);
    expect(next.pendingCheckout).toEqual(pendingCheckout);
  });

  it("attaches pending checkout immutably", () => {
    const source = draft();

    const next = withPendingCheckout(source, pendingCheckout);

    expect(next.pendingCheckout).toEqual(pendingCheckout);
    expect(source.pendingCheckout).toBeNull();
  });

  it("updates the voucher and invalidates a stale quote", () => {
    const source = draft({ voucherCode: "OLD", pendingCheckout });

    const next = applyVoucherCode(source, " NEW10 ");

    expect(next.voucherCode).toBe("NEW10");
    expect(next.pendingCheckout).toBeNull();
    expect(source.voucherCode).toBe("OLD");
  });

  it("preserves pending checkout when the normalized voucher is unchanged", () => {
    const source = draft({ voucherCode: "KFC10", pendingCheckout });

    expect(applyVoucherCode(source, " KFC10 ")).toBe(source);
  });

  it("invalidates pending checkout when a selected item changes", () => {
    const source = draft({ pendingCheckout });

    const next = applyMenuSelection(source, suggestion, 3, []);

    expect(next.items[0]?.quantity).toBe(3);
    expect(next.pendingCheckout).toBeNull();
  });

  it("stores selected item pricing and preserves the original numbered suggestions", () => {
    const secondSuggestion = { ...suggestion, id: "item-2", name: "Pepsi", price: 20_000 };
    const source = draft({ suggestions: [suggestion, secondSuggestion] });

    const next = updateOrderDraft(source, { action: "REFINE_SELECTION", foodQuery: null, categoryQuery: null, itemType: null, quantity: 2, preferences: [], preferenceUpdates: { excludeItemTypes: [], includeItemTypes: [] }, referencedSelection: "CURRENT", delivery: null, confirmationPhrase: null, needsClarification: false, clarificationQuestion: null }, [secondSuggestion]);

    expect(next.items).toContainEqual({ menuItemId: "item-2", name: "Pepsi", quantity: 2, unitPrice: 20_000, currency: "VND" });
    expect(next.suggestions).toEqual(source.suggestions);
  });

  it("preserves pending checkout when selection does not change", () => {
    const source = draft({ pendingCheckout });

    const next = applyMenuSelection(source, suggestion, 1, []);

    expect(next.pendingCheckout).toEqual(pendingCheckout);
  });
});
