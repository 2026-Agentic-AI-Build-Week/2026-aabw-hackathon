import { describe, expect, it } from "vitest";
import { updateOrderDraft } from "../../src/ai/order-draft.js";

describe("updateOrderDraft", () => {
  it("adds a validated selected item and updates its quantity", () => {
    const first = updateOrderDraft({ items: [], preferences: [], unresolvedFields: [] }, { action: "SEARCH_ITEM", foodQuery: "tender", categoryQuery: null, itemType: null, quantity: 2, preferences: [], referencedSelection: null, needsClarification: false, clarificationQuestion: null }, [{ id: "item-1", name: "3 Miếng Gà Rán Tender", slug: "3-mieng-ga-ran-tender", itemType: "single", description: null, price: 69000, currency: "VND", categories: ["Gà Rán"], score: 1 }]);
    expect(first.items).toEqual([{ menuItemId: "item-1", name: "3 Miếng Gà Rán Tender", quantity: 2 }]);
  });
});
