import { describe, expect, it } from "vitest";
import { createEmptyOrderDraft } from "../../src/ai/order-draft.js";
import { parseOrderDraft } from "../../src/ai/prisma-order-draft-store.js";

describe("parseOrderDraft", () => {
  it("restores valid checkout state and existing suggestions", () => {
    const parsed = parseOrderDraft({
      items: [{ menuItemId: "item-1", name: "Tender", quantity: 2 }],
      preferences: ["spicy"],
      unresolvedFields: ["phone"],
      suggestions: [{ id: "item-1", name: "Tender", slug: "tender", itemType: "single", description: null, price: 69000, currency: "VND", categories: ["Chicken"], score: 1 }],
      delivery: { recipientName: "Taylor", phone: "0900000000" },
      voucherCode: "KFC10",
      pendingCheckout: {
        quoteId: "quote-1",
        confirmationToken: "secret-token",
        confirmationPhrase: "CONFIRM 7A2F",
        expiresAt: "2026-07-12T12:00:00.000Z",
        idempotencyKey: "checkout-1",
      },
      menuPreferences: { excludedItemTypes: ["combo", "drink"] },
    });

    expect(parsed).toMatchObject({
      delivery: { recipientName: "Taylor", phone: "0900000000" },
      voucherCode: "KFC10",
      suggestions: [{ id: "item-1", name: "Tender" }],
      menuPreferences: { excludedItemTypes: ["combo", "drink"] },
    });
    expect(parsed.pendingCheckout).toEqual({
      quoteId: "quote-1",
      confirmationToken: "secret-token",
      confirmationPhrase: "CONFIRM 7A2F",
      expiresAt: "2026-07-12T12:00:00.000Z",
      idempotencyKey: "checkout-1",
    });
  });

  it("restores a valid persisted response language", () => {
    expect(parseOrderDraft({
      items: [],
      preferences: [],
      unresolvedFields: [],
      responseLanguage: "en",
    }).responseLanguage).toBe("en");
  });

  it("falls back to no response language for invalid persisted values", () => {
    expect(parseOrderDraft({
      items: [],
      preferences: [],
      unresolvedFields: [],
      responseLanguage: "fr",
    }).responseLanguage).toBeNull();
  });

  it.each([null, [], "legacy", { items: "invalid" }, { items: [{ menuItemId: "item-1", name: "Tender", quantity: -1 }] }])(
    "returns an empty draft for invalid or legacy JSON %#",
    (value) => {
      expect(parseOrderDraft(value)).toEqual(createEmptyOrderDraft());
    },
  );

  it("drops invalid optional checkout fields without losing a valid legacy cart", () => {
    expect(parseOrderDraft({
      items: [{ menuItemId: "item-1", name: "Tender", quantity: 1 }],
      preferences: [],
      unresolvedFields: [],
      delivery: { recipientName: 42 },
      voucherCode: 100,
      pendingCheckout: { quoteId: "quote-1" },
    })).toEqual({
      ...createEmptyOrderDraft(),
      items: [{ menuItemId: "item-1", name: "Tender", quantity: 1 }],
    });
  });

  it("defaults missing or malformed menu preferences for legacy sessions", () => {
    const legacy = {
      items: [{ menuItemId: "item-1", name: "Tender", quantity: 1 }],
      preferences: [],
      unresolvedFields: [],
    };

    expect(parseOrderDraft(legacy).menuPreferences).toEqual({ excludedItemTypes: [] });
    expect(parseOrderDraft({ ...legacy, menuPreferences: "combo" }).menuPreferences).toEqual({ excludedItemTypes: [] });
    expect(parseOrderDraft({ ...legacy, menuPreferences: { excludedItemTypes: ["dessert", 42] } }).menuPreferences).toEqual({ excludedItemTypes: [] });
  });

  it("restores only unique allowlisted menu exclusions", () => {
    const parsed = parseOrderDraft({
      items: [{ menuItemId: "item-1", name: "Tender", quantity: 1 }],
      menuPreferences: { excludedItemTypes: ["combo", "combo", "food", "unknown"] },
    });

    expect(parsed.menuPreferences).toEqual({ excludedItemTypes: ["combo", "food"] });
  });

  it("trims persisted menu item identifiers and names", () => {
    expect(parseOrderDraft({
      items: [{ menuItemId: " item-1 ", name: " Tender ", quantity: 1 }],
      preferences: [],
      unresolvedFields: [],
    }).items).toEqual([{ menuItemId: "item-1", name: "Tender", quantity: 1 }]);
  });

  it.each([
    { menuItemId: "", name: "Tender", quantity: 1 },
    { menuItemId: "   ", name: "Tender", quantity: 1 },
    { menuItemId: "item-1", name: "", quantity: 1 },
    { menuItemId: "item-1", name: "   ", quantity: 1 },
  ])("rejects persisted cart rows with blank identifiers or names %#", (item) => {
    expect(parseOrderDraft({ items: [item] })).toEqual(createEmptyOrderDraft());
  });

  it.each([
    "not-a-date",
    "2026-07-12",
    "2026-13-40T25:61:61.000Z",
    "2026-07-12T12:00:00",
  ])("drops pending checkout with an invalid ISO expiration: %s", (expiresAt) => {
    const parsed = parseOrderDraft({
      items: [{ menuItemId: "item-1", name: "Tender", quantity: 1 }],
      pendingCheckout: {
        quoteId: "quote-1",
        confirmationToken: "secret-token",
        confirmationPhrase: "CONFIRM 7A2F",
        expiresAt,
        idempotencyKey: "checkout-1",
      },
    });

    expect(parsed.pendingCheckout).toBeNull();
  });
});
