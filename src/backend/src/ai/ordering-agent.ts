import type { ChatAi, ChatAiInput, ChatAiResult } from "./ai-client.js";
import type { CheckoutResult } from "./checkout-orchestrator.js";
import { confirmationPhrasesMatch } from "./checkout-confirmation.js";
import type { MenuIntent } from "./menu-intent.js";
import type { MenuIntentExtractor } from "./menu-intent-extractor.js";
import type { MenuSearch, MenuSearchResult } from "./menu-search.js";
import { type DeliveryDraft } from "./checkout-types.js";
import { applyMenuPreferenceUpdate, removeDraftItem, type OrderDraft, updateOrderDraft } from "./order-draft.js";

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
    if (intent.action === "GREETING") return { text: await this.responder.generate(input, intent, []) };
    if (currentDraft && this.drafts && intent.action === "REMOVE_DRAFT_ITEM") {
      const item = findDraftItem(currentDraft, intent.foodQuery);
      if (!item) return { text: "I could not find that item in your cart. Ask to view your current order to see the item names." };
      const updatedDraft = removeDraftItem(currentDraft, item.menuItemId);
      await this.drafts.save(input.sessionId, updatedDraft);
      return { text: `Removed ${item.name}.\n${renderCurrentDraft(updatedDraft)}` };
    }
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
    const updatedDraft = currentDraft ? updateOrderDraft(currentDraft, intent, results) : undefined;
    if (this.drafts && updatedDraft) await this.drafts.save(input.sessionId, updatedDraft);
    console.info("Ordering intent processed", { action: intent.action, sessionId: input.sessionId, resultCount: results.length });
    const responseIntent = excludedItemTypes.length > 0
      ? { ...intent, preferenceUpdates: { ...intent.preferenceUpdates, excludeItemTypes: excludedItemTypes } }
      : intent;
    if (intent.action === "REFINE_SELECTION" && selectedSuggestion && updatedDraft) return { text: renderSelectedCart(updatedDraft, selectedSuggestion.name) };
    return { text: await this.responder.generate(input, responseIntent, results) };
  }

  private async requestQuote(userId: string, sessionId: string, draft: OrderDraft): Promise<ChatAiResult> {
    if (!this.checkout || !this.drafts) throw new Error("Checkout dependencies are unavailable.");
    const checkoutResult = await this.checkout.requestQuote(userId, sessionId, draft);
    await this.drafts.save(sessionId, checkoutResult.draft);
    return { text: checkoutResult.message ?? checkoutMessage(checkoutResult.event), ...(checkoutResult.event ? { checkoutEvent: checkoutResult.event } : {}) };
  }
}

function preferenceClarification(_text: string): string {
  return "Which menu type would you like to avoid: combos, food, or drinks?";
}

function preferenceUpdatedMessage(_text: string, excluded: string[], included: string[]): string {
  if (excluded.includes("combo")) {
    return "I will exclude combos for this chat. Which individual items would you like: burgers, chicken, rice, or sides?";
  }
  if (included.includes("combo")) {
    return "Combos are available in your suggestions again. Would you like combos or individual items?";
  }
  return "I updated your menu preferences for this chat. What would you like to see?";
}

function checkoutMessage(event: import("./checkout-types.js").CheckoutEvent | undefined): string {
  if (!event) return "I could not process the checkout request. Please try again.";
  if (event.state === "quote_ready") return `Your quote is ready. Please send ${event.quote.confirmationPhrase} exactly to create the order.`;
  return `Your order ${event.order.orderId} has been created. Pay with QR code: ${event.order.paymentQrCode}`;
}

function readSuggestion(text: string, suggestions: MenuSearchResult[] | undefined): MenuSearchResult | undefined {
  const normalized = text.trim();
  const match = normalized.match(/(?:món\s+)?số\s+(\d{1,2})$/iu)
    ?? normalized.match(/^(?:chọn|lấy)\s+(\d{1,2})$/iu)
    ?? normalized.match(/^(\d{1,2})(?:\s+(?:đi|please))?$/iu);
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
  if (draft.items.length === 0) return "Your current cart is empty. What would you like to order?";
  const items = draft.items.map((item) => `- ${item.quantity} x ${item.name}${item.unitPrice !== undefined ? ` — ${formatDraftMoney(item.unitPrice * item.quantity, item.currency)}` : ""}`).join("\n");
  const pricedItems = draft.items.filter((item) => item.unitPrice !== undefined);
  const total = pricedItems.length === draft.items.length ? `\nEstimated total: ${formatDraftMoney(pricedItems.reduce((sum, item) => sum + item.unitPrice! * item.quantity, 0), pricedItems[0]?.currency)}` : "";
  const checkoutHint = draft.pendingCheckout
    ? `\nA quote is ready. Send ${draft.pendingCheckout.confirmationPhrase} exactly to create the order.`
    : "\nYou can add another item or send checkout to request a quote.";
  return `Your current cart:\n${items}${total}${checkoutHint}`;
}

function renderSelectedCart(draft: OrderDraft, selectedName: string): string {
  const removalExample = draft.items[0]?.name ?? selectedName;
  return `Selected ${selectedName}.\n${renderCurrentDraft(draft)}\nTo remove an item, send "remove ${removalExample}".`;
}

function findDraftItem(draft: OrderDraft, query: string | null): OrderDraft["items"][number] | undefined {
  const normalized = query?.trim().toLocaleLowerCase();
  if (!normalized) return undefined;
  return draft.items.find((item) => item.name.toLocaleLowerCase() === normalized)
    ?? draft.items.find((item) => item.name.toLocaleLowerCase().includes(normalized));
}

function formatDraftMoney(amount: number, currency = "VND"): string {
  const formatted = new Intl.NumberFormat("vi-VN").format(amount);
  return currency === "VND" ? `${formatted}đ` : `${formatted} ${currency}`;
}

export interface MenuResponder { generate(input: ChatAiInput, intent: MenuIntent, results: MenuSearchResult[]): Promise<string>; }
export interface OrderDraftStore { load(sessionId: string): Promise<OrderDraft>; save(sessionId: string, draft: OrderDraft): Promise<void>; }
export interface CheckoutPort {
  requestQuote(userId: string, sessionId: string, draft: OrderDraft): Promise<CheckoutResult>;
  confirmOrder(userId: string, draft: OrderDraft, confirmationPhrase: string): Promise<CheckoutResult>;
}
