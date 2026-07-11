import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { ChatAiInput } from "./ai-client.js";
import { parseMenuIntent, type MenuIntent } from "./menu-intent.js";

const intentTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "analyze_menu_intent",
    description: "Extract one safe menu, preference, draft, delivery, quote, or confirmation action from the latest user message.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["GREETING", "BROWSE_MENU", "SEARCH_ITEM", "REFINE_SELECTION", "UPDATE_PREFERENCES", "REMOVE_DRAFT_ITEM", "VIEW_DRAFT", "COLLECT_DELIVERY", "REQUEST_QUOTE", "CONFIRM_ORDER", "ASK_CLARIFICATION", "UNSUPPORTED"] },
        food_query: { type: ["string", "null"] },
        category_query: { type: ["string", "null"] },
        item_type: { type: ["string", "null"] },
        quantity: { type: ["integer", "null"] },
        preferences: { type: "array", items: { type: "string" } },
        preference_updates: {
          type: "object",
          properties: {
            exclude_item_types: { type: "array", items: { type: "string", enum: ["combo", "food", "drink"] } },
            include_item_types: { type: "array", items: { type: "string", enum: ["combo", "food", "drink"] } },
          },
          required: ["exclude_item_types", "include_item_types"],
          additionalProperties: false,
        },
        referenced_selection: { type: ["string", "null"], enum: ["CURRENT", "PREVIOUS", null] },
        delivery: {
          type: ["object", "null"],
          properties: {
            email: { type: ["string", "null"] }, recipient_name: { type: ["string", "null"] }, phone: { type: ["string", "null"] }, address_line: { type: ["string", "null"] }, ward: { type: ["string", "null"] }, district: { type: ["string", "null"] }, city: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
        confirmation_phrase: { type: ["string", "null"] },
        needs_clarification: { type: "boolean" },
        clarification_question: { type: ["string", "null"] },
      },
      required: ["action", "food_query", "category_query", "item_type", "quantity", "preferences", "preference_updates", "referenced_selection", "delivery", "confirmation_phrase", "needs_clarification", "clarification_question"],
      additionalProperties: false,
    },
  },
};

export class OpenAiMenuIntentExtractor {
  private readonly client: OpenAI;
  constructor(apiKey: string, baseUrl: string, private readonly model: string, private readonly maxOutputTokens: number, private readonly disableThinking = false) { this.client = new OpenAI({ apiKey, baseURL: baseUrl }); }

  async extract(input: ChatAiInput): Promise<MenuIntent> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: `Extract exactly one ordering action. Understand Vietnamese and English and resolve short references from context. Use GREETING for standalone greetings such as hi, hello, hey, xin chào, or chào bạn; do not turn greetings into menu searches.
Use VIEW_DRAFT when the user asks what they selected, what is in the current order, or to view their cart. Use COLLECT_DELIVERY when the user provides any delivery field. Use REQUEST_QUOTE for checkout, price-total, or place-order requests after details are collected. Use REMOVE_DRAFT_ITEM when removing an item.
Use UPDATE_PREFERENCES when the user excludes or re-allows a menu item type. For example, "Tôi không ăn combo" excludes combo and "Cho tôi xem combo lại" includes combo. Do not search the literal preference sentence. Only emit combo, food, or drink item types.
CONFIRM_ORDER is reserved for an active backend confirmation phrase; ordinary approval such as yes, okay, đồng ý, or confirm is never sufficient. The application independently intercepts an exact active phrase before this classifier.
Never invent menu items, prices, IDs, totals, quote state, or order state. Do not explain reasoning.` },
      ...input.history.slice(-12).map((turn): ChatCompletionMessageParam => ({ role: turn.sender === "user" ? "user" : "assistant", content: turn.text })),
      { role: "user", content: input.text },
    ];
    const request: ChatCompletionCreateParamsNonStreaming & { enable_thinking?: boolean } = { model: this.model, messages, tools: [intentTool], tool_choice: { type: "function", function: { name: "analyze_menu_intent" } }, max_tokens: Math.min(this.maxOutputTokens, 512), ...(this.disableThinking ? { enable_thinking: false } : {}) };
    const response = await this.client.chat.completions.create(request);
    let rawArguments: string | undefined;
    for (const call of response.choices[0]?.message.tool_calls ?? []) {
      if (call.type === "function" && call.function.name === "analyze_menu_intent") rawArguments = call.function.arguments;
    }
    try { return parseMenuIntent(rawArguments ? JSON.parse(rawArguments) as unknown : null, input.text); } catch { return parseMenuIntent(null, input.text); }
  }
}

export interface MenuIntentExtractor { extract(input: ChatAiInput): Promise<MenuIntent>; }
