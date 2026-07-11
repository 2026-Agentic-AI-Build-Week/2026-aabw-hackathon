import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { ChatAiInput } from "./ai-client.js";
import { parseMenuIntent, type MenuIntent } from "./menu-intent.js";

const intentTool: ChatCompletionTool = { type: "function", function: { name: "analyze_menu_intent", description: "Extract a safe structured ordering intent from the user's latest message and conversation context.", parameters: { type: "object", properties: { action: { type: "string", enum: ["BROWSE_MENU", "SEARCH_ITEM", "REFINE_SELECTION", "ASK_CLARIFICATION", "UNSUPPORTED"] }, food_query: { type: ["string", "null"] }, category_query: { type: ["string", "null"] }, item_type: { type: ["string", "null"] }, quantity: { type: ["integer", "null"] }, preferences: { type: "array", items: { type: "string" } }, referenced_selection: { type: ["string", "null"], enum: ["CURRENT", "PREVIOUS", null] }, needs_clarification: { type: "boolean" }, clarification_question: { type: ["string", "null"] } }, required: ["action", "food_query", "category_query", "item_type", "quantity", "preferences", "referenced_selection", "needs_clarification", "clarification_question"], additionalProperties: false } } };

export class OpenAiMenuIntentExtractor {
  private readonly client: OpenAI;
  constructor(apiKey: string, baseUrl: string, private readonly model: string, private readonly maxOutputTokens: number) { this.client = new OpenAI({ apiKey, baseURL: baseUrl }); }

  async extract(input: ChatAiInput): Promise<MenuIntent> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: "Extract ordering intent only. Understand Vietnamese and English. Resolve short references from conversation context. Never invent catalog items, prices, or IDs. Do not explain reasoning." },
      ...input.history.slice(-12).map((turn): ChatCompletionMessageParam => ({ role: turn.sender === "user" ? "user" : "assistant", content: turn.text })),
      { role: "user", content: input.text },
    ];
    const response = await this.client.chat.completions.create({ model: this.model, messages, tools: [intentTool], tool_choice: { type: "function", function: { name: "analyze_menu_intent" } }, max_tokens: Math.min(this.maxOutputTokens, 512) });
    let rawArguments: string | undefined;
    for (const call of response.choices[0]?.message.tool_calls ?? []) {
      if (call.type === "function" && call.function.name === "analyze_menu_intent") rawArguments = call.function.arguments;
    }
    try { return parseMenuIntent(rawArguments ? JSON.parse(rawArguments) as unknown : null, input.text); } catch { return parseMenuIntent(null, input.text); }
  }
}

export interface MenuIntentExtractor { extract(input: ChatAiInput): Promise<MenuIntent>; }
