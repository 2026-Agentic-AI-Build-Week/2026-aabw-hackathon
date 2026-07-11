import { describe, expect, it } from "vitest";
import { buildMenuSearchTerms, shouldSearchMenu } from "../../src/ai/menu-search.js";

describe("menu intent helpers", () => {
  it("recognizes common chicken requests as menu-search intent", () => {
    expect(shouldSearchMenu("Tenders")).toBe(true);
    expect(shouldSearchMenu("Chicken wings?")).toBe(true);
    expect(shouldSearchMenu("Cho mình gà rán")).toBe(true);
  });

  it("expands English poultry aliases to catalog terms", () => {
    expect(buildMenuSearchTerms("Tenders")).toEqual(expect.arrayContaining(["tender", "gà rán tender"]));
    expect(buildMenuSearchTerms("Chicken wings")).toEqual(expect.arrayContaining(["cánh gà", "gà rán", "tender"]));
  });
});
