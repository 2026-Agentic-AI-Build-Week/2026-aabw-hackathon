import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("order schema", () => {
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

  it("removes cart models from the current schema", () => {
    expect(schema).not.toMatch(/model Cart\b/);
    expect(schema).not.toMatch(/CartItem/);
    expect(schema).not.toMatch(/CartStatus/);
  });

  it("owns quotes directly by user and conversation session", () => {
    const quote = schema.slice(schema.indexOf("model OrderQuote {"), schema.indexOf("model OrderQuoteItem {"));
    expect(quote).toContain("userId");
    expect(quote).toContain("sessionId");
    expect(quote).not.toContain("cartId");
  });
});
