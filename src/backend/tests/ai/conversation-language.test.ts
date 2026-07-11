import { describe, expect, it } from "vitest";
import { detectInitialConversationLanguage, isGreetingOnly } from "../../src/ai/conversation-language.js";

describe("conversation language", () => {
  it("detects Vietnamese and English first messages", () => {
    expect(detectInitialConversationLanguage("Tôi muốn ăn gà")).toBe("vi");
    expect(detectInitialConversationLanguage("Hi, I want a burger")).toBe("en");
  });

  it("defaults neutral product-only messages to Vietnamese", () => {
    expect(detectInitialConversationLanguage("Burger")).toBe("vi");
  });

  it("recognizes greeting-only messages without consuming a request", () => {
    expect(isGreetingOnly("Hi!")).toBe(true);
    expect(isGreetingOnly("Xin chào")).toBe(true);
    expect(isGreetingOnly("Hi, show me burgers")).toBe(false);
  });
});
