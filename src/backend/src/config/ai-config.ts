export type AiProvider = "openai" | "openrouter";

export type AiConfig = {
  apiKey?: string;
  baseUrl: string;
  maxOutputTokens: number;
  modelName: string;
  provider: AiProvider;
  useDemoFallback: boolean;
};

export function loadAiConfig(environment: NodeJS.ProcessEnv = process.env): AiConfig {
  const provider = readProvider(environment.AI_PROVIDER);
  const apiKey = environment.AI_API_KEY?.trim() || undefined;
  const modelName = environment.AI_MODEL_NAME?.trim() || (provider === "openrouter" ? "openai/gpt-4.1-mini" : "gpt-4.1-mini");
  const baseUrl = provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1";
  const maxOutputTokens = readMaxOutputTokens(environment.AI_MAX_OUTPUT_TOKENS);
  const production = environment.NODE_ENV === "production";
  if (production && !apiKey) throw new Error("AI_API_KEY is required in production.");
  return { apiKey, baseUrl, maxOutputTokens, modelName, provider, useDemoFallback: !apiKey };
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
  if (provider !== "openai" && provider !== "openrouter") {
    throw new Error("AI_PROVIDER must be either openai or openrouter.");
  }
  return provider;
}
