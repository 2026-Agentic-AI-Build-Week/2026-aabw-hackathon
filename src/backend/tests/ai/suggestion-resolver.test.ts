import { describe, expect, it } from "vitest";
import type { MenuSearchResult } from "../../src/ai/menu-search.js";
import { normalizeSelectionText, resolveSuggestion } from "../../src/ai/suggestion-resolver.js";

const suggestions: MenuSearchResult[] = [
  { id: "yo", name: "Burger Gà Yo", slug: "burger-ga-yo", itemType: "food", description: null, price: 30000, currency: "VND", categories: [], score: 1 },
  { id: "tender", name: "3 Miếng Gà Rán Tender", slug: "ga-ran-tender", itemType: "food", description: null, price: 42000, currency: "VND", categories: [], score: 1 },
];

describe("suggestion resolution", () => {
  it("matches normalized names, slugs, and conversational suffixes", () => {
    expect(resolveSuggestion("Gà Yo đi", suggestions)).toEqual({ kind: "match", suggestion: suggestions[0] });
    expect(resolveSuggestion("burger-ga-yo nhé", suggestions)).toEqual({ kind: "match", suggestion: suggestions[0] });
  });

  it("prefers an exact normalized name over broader token matches", () => {
    const overlappingSuggestions = [
      suggestions[0],
      { id: "yo-combo", name: "Burger Gà Yo Combo", slug: "burger-ga-yo-combo", itemType: "combo", description: null, price: 50000, currency: "VND", categories: [], score: 1 },
    ];

    expect(resolveSuggestion("Burger Gà Yo", overlappingSuggestions)).toEqual({ kind: "match", suggestion: overlappingSuggestions[0] });
  });

  it("removes leading English and Vietnamese quantity phrases", () => {
    expect(normalizeSelectionText("2 Burger Gà Yo")).toBe("burger ga yo");
    expect(normalizeSelectionText("2 cái Burger Gà Yo")).toBe("burger ga yo");
    expect(resolveSuggestion("2 Burger Gà Yo", suggestions)).toEqual({ kind: "match", suggestion: suggestions[0] });
    expect(resolveSuggestion("2 cái Burger Gà Yo", suggestions)).toEqual({ kind: "match", suggestion: suggestions[0] });
  });

  it("resolves one-based ordinal selections", () => {
    for (const selection of ["1", "số 1", "món 1"]) {
      expect(resolveSuggestion(selection, suggestions)).toEqual({ kind: "match", suggestion: suggestions[0] });
    }
  });

  it("returns none when a recognized ordinal is out of range", () => {
    const twoSuggestions = [
      suggestions[0],
      { id: "combo-3", name: "Combo 3", slug: "combo-3", itemType: "combo", description: null, price: 60000, currency: "VND", categories: [], score: 1 },
    ];

    expect(resolveSuggestion("3", twoSuggestions)).toEqual({ kind: "none" });
  });

  it("returns all matches when selection tokens are ambiguous", () => {
    expect(resolveSuggestion("Gà", suggestions)).toEqual({ kind: "ambiguous", suggestions });
  });

  it("does not match absent names", () => {
    expect(resolveSuggestion("Pepsi", suggestions)).toEqual({ kind: "none" });
  });
});
