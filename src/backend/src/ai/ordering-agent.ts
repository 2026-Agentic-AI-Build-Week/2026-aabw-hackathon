import type { ChatAi, ChatAiInput, ChatAiResult } from "./ai-client.js";
import type { CheckoutResult } from "./checkout-orchestrator.js";
import { confirmationPhrasesMatch } from "./checkout-confirmation.js";
import type { MenuIntent } from "./menu-intent.js";
import type { MenuIntentExtractor } from "./menu-intent-extractor.js";
import type { MenuSearch, MenuSearchResult } from "./menu-search.js";
import { type DeliveryDraft } from "./checkout-types.js";
import { applyMenuPreferenceUpdate, type OrderDraft, updateOrderDraft } from "./order-draft.js";

export class OrderingAgent implements ChatAi {
  constructor(private readonly extractor: MenuIntentExtractor, private readonly menuSearch: MenuSearch, private readonly responder: MenuResponder, private readonly drafts?: OrderDraftStore, private readonly checkout?: CheckoutPort) {}

  async respond(input: ChatAiInput): Promise<ChatAiResult> {
    const currentDraft = this.drafts ? await this.drafts.load(input.sessionId) : undefined;
    if (currentDraft?.pendingCheckout && confirmationPhrasesMatch(input.text, currentDraft.pendingCheckout.confirmationPhrase) && this.checkout && this.drafts) {
      const checkoutResult = await this.checkout.confirmOrder(input.userId, currentDraft, input.text.trim());
      await this.drafts.save(input.sessionId, checkoutResult.draft);
      return { text: checkoutResult.message ?? checkoutMessage(checkoutResult.event), ...(checkoutResult.event ? { checkoutEvent: checkoutResult.event } : {}) };
    }
    const extractedIntent = await this.extractor.extract(input);
    const intent = extractedIntent.action === "COLLECT_DELIVERY"
      ? { ...extractedIntent, delivery: mergeDeliveryFromMessage(extractedIntent.delivery, input.text) }
      : extractedIntent;
    if (currentDraft && this.drafts && intent.action === "UPDATE_PREFERENCES") {
      const update = intent.preferenceUpdates;
      if (update.excludeItemTypes.length === 0 && update.includeItemTypes.length === 0) {
        return { text: preferenceClarification(input.text) };
      }
      const updatedDraft = applyMenuPreferenceUpdate(currentDraft, update);
      await this.drafts.save(input.sessionId, updatedDraft);
      return { text: preferenceUpdatedMessage(input.text, update.excludeItemTypes, update.includeItemTypes) };
    }
    if (currentDraft && intent.action === "VIEW_DRAFT") return { text: renderCurrentDraft(currentDraft) };
    if (currentDraft && this.checkout && this.drafts && !currentDraft.pendingCheckout && hasCompleteCheckoutDetails(currentDraft) && isQuoteApproval(input.text)) {
      return this.requestQuote(input.userId, input.sessionId, currentDraft);
    }
    if (currentDraft && this.checkout && this.drafts && intent.action === "REQUEST_QUOTE") {
      return this.requestQuote(input.userId, input.sessionId, currentDraft);
    }
    if (currentDraft && this.checkout && this.drafts && intent.action === "CONFIRM_ORDER") {
      const checkoutResult = await this.checkout.confirmOrder(input.userId, currentDraft, intent.confirmationPhrase ?? input.text);
      await this.drafts.save(input.sessionId, checkoutResult.draft);
      return { text: checkoutResult.message ?? checkoutMessage(checkoutResult.event), ...(checkoutResult.event ? { checkoutEvent: checkoutResult.event } : {}) };
    }
    if (currentDraft && this.checkout && this.drafts && intent.action === "COLLECT_DELIVERY" && intent.delivery) {
      const updatedDraft = updateOrderDraft(currentDraft, intent, []);
      if (hasCompleteCheckoutDetails(updatedDraft)) return this.requestQuote(input.userId, input.sessionId, updatedDraft);
      await this.drafts.save(input.sessionId, updatedDraft);
      return { text: missingDeliveryMessage(updatedDraft.delivery) };
    }
    if (intent.needsClarification && intent.clarificationQuestion) return { text: intent.clarificationQuestion };
    const selectedSuggestion = intent.action === "REFINE_SELECTION" ? readSuggestion(input.text, currentDraft?.suggestions) : undefined;
    const excludedItemTypes = currentDraft?.menuPreferences.excludedItemTypes ?? [];
    const categories = intent.categoryQuery ? await this.menuSearch.searchCategories(intent.categoryQuery) : [];
    const results = selectedSuggestion ? [selectedSuggestion] : intent.action === "BROWSE_MENU"
      ? await this.menuSearch.browse(8, { excludedItemTypes })
      : await this.menuSearch.search({ query: intent.foodQuery ?? input.text, categoryQuery: intent.categoryQuery, itemType: intent.itemType, categoryIds: categories.map((category) => category.id), excludedItemTypes, limit: 8 });
    if (this.drafts && currentDraft) await this.drafts.save(input.sessionId, updateOrderDraft(currentDraft, intent, results));
    console.info("Ordering intent processed", { action: intent.action, sessionId: input.sessionId, resultCount: results.length });
    const responseIntent = excludedItemTypes.length > 0
      ? { ...intent, preferenceUpdates: { ...intent.preferenceUpdates, excludeItemTypes: excludedItemTypes } }
      : intent;
    return { text: await this.responder.generate(input, responseIntent, results) };
  }

  private async requestQuote(userId: string, sessionId: string, draft: OrderDraft): Promise<ChatAiResult> {
    if (!this.checkout || !this.drafts) throw new Error("Checkout dependencies are unavailable.");
    const checkoutResult = await this.checkout.requestQuote(userId, sessionId, draft);
    await this.drafts.save(sessionId, checkoutResult.draft);
    return { text: checkoutResult.message ?? checkoutMessage(checkoutResult.event), ...(checkoutResult.event ? { checkoutEvent: checkoutResult.event } : {}) };
  }
}

function preferenceClarification(text: string): string {
  return usesVietnamese(text)
    ? "Bạn muốn tránh loại món nào: combo, món ăn hay đồ uống?"
    : "Which menu type would you like to avoid: combos, food, or drinks?";
}

function preferenceUpdatedMessage(text: string, excluded: string[], included: string[]): string {
  const vietnamese = usesVietnamese(text);
  if (excluded.includes("combo")) {
    return vietnamese
      ? "Mình đã ghi nhớ bạn không muốn combo. Bạn muốn xem món lẻ loại nào: burger, gà, cơm hay món ăn kèm?"
      : "I will exclude combos for this chat. Which individual items would you like: burgers, chicken, rice, or sides?";
  }
  if (included.includes("combo")) {
    return vietnamese
      ? "Mình đã bỏ giới hạn combo. Bạn muốn xem combo hay món lẻ nào?"
      : "Combos are available in your suggestions again. Would you like combos or individual items?";
  }
  return vietnamese
    ? "Mình đã cập nhật sở thích thực đơn cho phiên chat này. Bạn muốn xem món gì?"
    : "I updated your menu preferences for this chat. What would you like to see?";
}

function usesVietnamese(text: string): boolean {
  return /[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/iu.test(text)
    || /\b(?:tôi|không|ăn|muốn|món|combo|xem|lại)\b/iu.test(text);
}

function checkoutMessage(event: import("./checkout-types.js").CheckoutEvent | undefined): string {
  if (!event) return "I could not process the checkout request. Please try again.";
  if (event.state === "quote_ready") return `Your quote is ready. Please send ${event.quote.confirmationPhrase} exactly to create the order.`;
  return `Your order ${event.order.orderId} has been created.`;
}

function readSuggestion(text: string, suggestions: MenuSearchResult[] | undefined): MenuSearchResult | undefined {
  const match = text.trim().match(/^(\d{1,2})(?:\s|$)/);
  if (!match || !suggestions) return undefined;
  return suggestions[Number(match[1]) - 1];
}

function mergeDeliveryFromMessage(extracted: DeliveryDraft | null, text: string): DeliveryDraft | null {
  const detected = detectCommaSeparatedDelivery(text);
  const merged = { ...detected, ...(extracted ?? {}) };
  return Object.keys(merged).length > 0 ? merged : null;
}

function detectCommaSeparatedDelivery(text: string): DeliveryDraft {
  const values = text.split(",").map((value) => value.trim()).filter(Boolean);
  const emailIndex = values.findIndex((value) => /^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/u.test(value));
  const phoneIndex = values.findIndex((value) => /^(?:\+?84|0)\d{9,10}$/u.test(value));
  if (emailIndex !== 0 || phoneIndex !== 2 || values.length < 5) return {};
  const city = values.at(-1);
  const addressLine = values.slice(3, -1).join(", ");
  return {
    email: values[0],
    recipientName: values[1],
    phone: values[2],
    ...(addressLine ? { addressLine } : {}),
    ...(city ? { city } : {}),
  };
}

function hasCompleteCheckoutDetails(draft: OrderDraft): boolean {
  const delivery = draft.delivery;
  return Boolean(draft.items.length > 0 && delivery?.email && delivery.recipientName && delivery.phone && delivery.addressLine && delivery.city);
}

function isQuoteApproval(text: string): boolean {
  return /^(?:xác nhận|đồng ý|ok|okay|yes|confirm)$/iu.test(text.trim());
}

function missingDeliveryMessage(delivery: DeliveryDraft | null | undefined): string {
  const missing = [
    !delivery?.email ? "email" : null,
    !delivery?.recipientName ? "recipient name" : null,
    !delivery?.phone ? "phone number" : null,
    !delivery?.addressLine ? "street address" : null,
    !delivery?.city ? "city" : null,
  ].filter((field): field is string => field !== null);
  return `I saved your delivery details. Please provide: ${missing.join(", ")}.`;
}

function renderCurrentDraft(draft: OrderDraft): string {
  if (draft.items.length === 0) return "Đơn hàng hiện tại của bạn chưa có món nào. Bạn muốn chọn món gì?";
  const items = draft.items.map((item) => `- ${item.quantity} x ${item.name}`).join("\n");
  const checkoutHint = draft.pendingCheckout
    ? `\nBạn đã có quote. Hãy gửi chính xác ${draft.pendingCheckout.confirmationPhrase} để tạo đơn.`
    : "\nBạn có thể thêm món hoặc nhắn đặt hàng để nhận quote.";
  return `Đơn hàng hiện tại của bạn:\n${items}${checkoutHint}`;
}

export interface MenuResponder { generate(input: ChatAiInput, intent: MenuIntent, results: MenuSearchResult[]): Promise<string>; }
export interface OrderDraftStore { load(sessionId: string): Promise<OrderDraft>; save(sessionId: string, draft: OrderDraft): Promise<void>; }
export interface CheckoutPort {
  requestQuote(userId: string, sessionId: string, draft: OrderDraft): Promise<CheckoutResult>;
  confirmOrder(userId: string, draft: OrderDraft, confirmationPhrase: string): Promise<CheckoutResult>;
}
