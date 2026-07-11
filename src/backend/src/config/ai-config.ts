export type AiProvider = "openai" | "openrouter" | "dashscope";

export type AiConfig = {
  apiKey?: string;
  baseUrl: string;
  disableThinking: boolean;
  maxOutputTokens: number;
  modelName: string;
  provider: AiProvider;
  useDemoFallback: boolean;
};

export function loadAiConfig(environment: NodeJS.ProcessEnv = process.env): AiConfig {
  const provider = readProvider(environment.AI_PROVIDER);
  const apiKey = (provider === "dashscope" ? environment.DASHSCOPE_API_KEY : environment.AI_API_KEY)?.trim() || undefined;
  const modelName = environment.AI_MODEL_NAME?.trim() || defaultModel(provider);
  const baseUrl = providerBaseUrl(provider);
  const maxOutputTokens = readMaxOutputTokens(environment.AI_MAX_OUTPUT_TOKENS);
  const production = environment.NODE_ENV === "production";
  if (production && !apiKey) throw new Error(provider === "dashscope" ? "DASHSCOPE_API_KEY is required in production." : "AI_API_KEY is required in production.");
  return { apiKey, baseUrl, disableThinking: provider === "dashscope", maxOutputTokens, modelName, provider, useDemoFallback: !apiKey };
}

function readMaxOutputTokens(value: string | undefined): number {
  if (!value?.trim()) return 1024;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 64 || parsed > 4096) {
    throw new Error("AI_MAX_OUTPUT_TOKENS must be an integer between 64 and 4096.");
  }
  return parsed;
}

function readProvider(value: string | undefined): AiProvider {
  const provider = value?.trim().toLowerCase() || "openai";
  if (provider !== "openai" && provider !== "openrouter" && provider !== "dashscope") {
    throw new Error("AI_PROVIDER must be openai, openrouter, or dashscope.");
  }
  return provider;
}

function defaultModel(provider: AiProvider): string {
  if (provider === "dashscope") return "qwen3.7-plus";
  if (provider === "openrouter") return "openai/gpt-4.1-mini";
  return "gpt-4.1-mini";
}

function providerBaseUrl(provider: AiProvider): string {
  if (provider === "dashscope") return "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
  if (provider === "openrouter") return "https://openrouter.ai/api/v1";
  return "https://api.openai.com/v1";
}
