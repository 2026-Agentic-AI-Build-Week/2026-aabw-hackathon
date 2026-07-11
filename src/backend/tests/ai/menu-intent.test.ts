import { describe, expect, it } from "vitest";
import { parseMenuIntent } from "../../src/ai/menu-intent.js";

describe("parseMenuIntent", () => {
  it("parses structured item-search intent", () => {
    expect(parseMenuIntent({ action: "SEARCH_ITEM", food_query: "chicken tender", category_query: "fried chicken", item_type: null, quantity: 5, preferences: ["spicy"], referenced_selection: "CURRENT", needs_clarification: false, clarification_question: null })).toMatchObject({ action: "SEARCH_ITEM", foodQuery: "chicken tender", quantity: 5 });
  });

  it("falls back conservatively for malformed provider output", () => {
    expect(parseMenuIntent({}, "Tenders")).toMatchObject({ action: "SEARCH_ITEM", foodQuery: "Tenders", needsClarification: false });
  });
});
