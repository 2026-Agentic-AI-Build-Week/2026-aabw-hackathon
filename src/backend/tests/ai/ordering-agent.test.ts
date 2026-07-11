import { describe, expect, it, vi } from "vitest";
import { OrderingAgent } from "../../src/ai/ordering-agent.js";

describe("OrderingAgent", () => {
  it("searches categories then persists a validated draft", async () => {
    const extractor = { extract: vi.fn().mockResolvedValue({ action: "SEARCH_ITEM", foodQuery: "tender", categoryQuery: "fried chicken", itemType: null, quantity: 2, preferences: [], referencedSelection: null, needsClarification: false, clarificationQuestion: null }) };
    const search = { searchCategories: vi.fn().mockResolvedValue([{ id: "category-1", name: "Fried Chicken", slug: "fried-chicken", score: 1 }]), search: vi.fn().mockResolvedValue([{ id: "item-1", name: "Tender", slug: "tender", itemType: "single", description: null, price: 1, currency: "VND", categories: [], score: 1 }]) };
    const drafts = { load: vi.fn().mockResolvedValue({ items: [], preferences: [], unresolvedFields: [] }), save: vi.fn().mockResolvedValue(undefined) };
    const responder = { generate: vi.fn().mockResolvedValue("Tender is available") };
    const agent = new OrderingAgent(extractor, search, responder, drafts);
    await agent.respond({ userId: "user-1", sessionId: "session-1", text: "2 tenders", history: [] });
    expect(search.search).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: ["category-1"], query: "tender" }));
    expect(drafts.save).toHaveBeenCalledWith("session-1", expect.objectContaining({ items: [{ menuItemId: "item-1", name: "Tender", quantity: 2 }] }));
  });
});
