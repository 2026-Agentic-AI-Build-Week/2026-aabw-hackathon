import { describe, expect, it } from "vitest";
import { buildConversationMessages, resolveMenuSearchQuery } from "../../src/ai/openai-ai-client.js";

describe("resolveMenuSearchQuery", () => {
  it("uses the declared query argument", () => {
    expect(resolveMenuSearchQuery({ query: "zinger burger" }, "fallback")).toBe("zinger burger");
  });

  it("accepts common provider-specific argument aliases", () => {
    expect(resolveMenuSearchQuery({ search: "fried chicken" }, "fallback")).toBe("fried chicken");
    expect(resolveMenuSearchQuery({ keyword: "pepsi" }, "fallback")).toBe("pepsi");
  });

  it("falls back to the user message for malformed tool arguments", () => {
    expect(resolveMenuSearchQuery({}, "Show me popular combos")).toBe("Show me popular combos");
    expect(resolveMenuSearchQuery(null, "Show me popular combos")).toBe("Show me popular combos");
  });
});

describe("buildConversationMessages", () => {
  it("preserves recent context without duplicating the current user turn", () => {
    const messages = buildConversationMessages({
      userId: "user-1",
      sessionId: "session-1",
      text: "Add a Pepsi too",
      history: [
        { sender: "user", text: "I want a Zinger combo" },
        { sender: "bot", text: "Would you like a drink?" },
        { sender: "user", text: "Add a Pepsi too" },
      ],
    });

    expect(messages.map((message) => message.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(messages.at(-1)).toMatchObject({ role: "user", content: "Add a Pepsi too" });
  });
});
