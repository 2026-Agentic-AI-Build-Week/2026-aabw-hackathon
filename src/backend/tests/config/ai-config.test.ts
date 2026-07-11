import { describe, expect, it } from "vitest";
import { loadAiConfig } from "../../src/config/ai-config.js";

describe("loadAiConfig", () => {
  it("uses OpenAI defaults when an OpenAI key is configured", () => {
    expect(loadAiConfig({ AI_API_KEY: "sk-openai", AI_MODEL_NAME: "gpt-4.1-mini" })).toMatchObject({
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      modelName: "gpt-4.1-mini",
      maxOutputTokens: 1024,
      useDemoFallback: false,
    });
  });

  it("configures the OpenRouter OpenAI-compatible endpoint", () => {
    expect(loadAiConfig({ AI_PROVIDER: "openrouter", AI_API_KEY: "sk-or-v1-demo", AI_MODEL_NAME: "google/gemini-2.5-flash" })).toMatchObject({
      provider: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      modelName: "google/gemini-2.5-flash",
      maxOutputTokens: 1024,
      useDemoFallback: false,
    });
  });

  it("configures DashScope using its dedicated environment key", () => {
    expect(loadAiConfig({ AI_PROVIDER: "dashscope", DASHSCOPE_API_KEY: "dashscope-key" })).toMatchObject({
      provider: "dashscope",
      baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      modelName: "qwen3.7-plus",
      disableThinking: true,
      useDemoFallback: false,
    });
  });

  it("rejects an unsupported configured provider", () => {
    expect(() => loadAiConfig({ AI_PROVIDER: "unknown", AI_API_KEY: "key" })).toThrow("AI_PROVIDER must be openai, openrouter, or dashscope.");
  });

  it("accepts a bounded output-token override", () => {
    expect(loadAiConfig({ AI_API_KEY: "key", AI_MAX_OUTPUT_TOKENS: "512" }).maxOutputTokens).toBe(512);
  });

  it("rejects an invalid output-token limit", () => {
    expect(() => loadAiConfig({ AI_API_KEY: "key", AI_MAX_OUTPUT_TOKENS: "zero" })).toThrow("AI_MAX_OUTPUT_TOKENS must be an integer between 64 and 4096.");
  });
});
