import { describe, expect, it } from "vitest";
import { ValidatedMenuResponder } from "../../src/ai/validated-menu-responder.js";

const burgerYo = { id: "item-1", name: "Burger Gà Yo", slug: "burger-ga-yo", itemType: "food", description: "1 phần Burger Gà Yo", price: 30000, currency: "VND", categories: ["Burger"], score: 1 };

describe("ValidatedMenuResponder", () => {
  it("states an item returned by the database is available instead of letting the model deny it", async () => {
    const response = await new ValidatedMenuResponder().generate(
      { userId: "user-1", sessionId: "session-1", text: "Gà yo", history: [] },
      { action: "SEARCH_ITEM", foodQuery: "Gà yo", categoryQuery: null, itemType: null, quantity: null, preferences: [], preferenceUpdates: { excludeItemTypes: [], includeItemTypes: [] }, referencedSelection: null, delivery: null, confirmationPhrase: null, needsClarification: false, clarificationQuestion: null },
      [burgerYo],
    );

    expect(response).toContain("Burger Gà Yo");
    expect(response).toContain("30.000đ");
    expect(response.toLocaleLowerCase()).not.toContain("không có sẵn");
  });

  it("does not invent a stock status when the authoritative search has no matches", async () => {
    const response = await new ValidatedMenuResponder().generate(
      { userId: "user-1", sessionId: "session-1", text: "món không tồn tại", history: [] },
      { action: "SEARCH_ITEM", foodQuery: "món không tồn tại", categoryQuery: null, itemType: null, quantity: null, preferences: [], preferenceUpdates: { excludeItemTypes: [], includeItemTypes: [] }, referencedSelection: null, delivery: null, confirmationPhrase: null, needsClarification: false, clarificationQuestion: null },
      [],
    );

    expect(response).toContain("không tìm thấy món phù hợp đang bán");
    expect(response).not.toContain("Burger Gà Yo");
    expect(response.toLocaleLowerCase()).not.toMatch(/hết hàng|sold out/u);
  });

});
