import { describe, expect, it, vi } from "vitest";
import { PrismaMenuSearch, buildMenuSearchTerms, shouldSearchMenu } from "../../src/ai/menu-search.js";

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

describe("PrismaMenuSearch exclusions", () => {
  it("adds allowlisted exclusions to browse SQL", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const search = new PrismaMenuSearch({ $queryRaw: queryRaw } as never);

    await search.browse(8, { excludedItemTypes: ["combo", "drink"] });

    const query = queryRaw.mock.calls[0]?.[0] as { strings: string[]; values: unknown[] };
    expect(query.strings.join("?")).toContain("mi.item_type NOT IN");
    expect(query.values).toEqual(expect.arrayContaining(["combo", "drink"]));
  });

  it("adds allowlisted exclusions to item search SQL", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const search = new PrismaMenuSearch({ $queryRaw: queryRaw } as never);

    await search.search({ query: "burger", excludedItemTypes: ["combo"] });

    const query = queryRaw.mock.calls[0]?.[0] as { strings: string[]; values: unknown[] };
    expect(query.strings.join("?")).toContain("mi.item_type NOT IN");
    expect(query.values).toContain("combo");
  });

  it("discards unknown exclusions before constructing SQL", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const search = new PrismaMenuSearch({ $queryRaw: queryRaw } as never);

    await search.search({ query: "burger", excludedItemTypes: ["combo", "dessert" as never] });

    const query = queryRaw.mock.calls[0]?.[0] as { values: unknown[] };
    expect(query.values).toContain("combo");
    expect(query.values).not.toContain("dessert");
  });
});
