import type { ChatAiInput } from "./ai-client.js";
import type { MenuIntent } from "./menu-intent.js";
import type { MenuIntentExtractor } from "./menu-intent-extractor.js";
import type { MenuResponder } from "./ordering-agent.js";
import type { MenuSearchResult } from "./menu-search.js";

export class DemoMenuIntentExtractor implements MenuIntentExtractor {
  async extract(input: ChatAiInput): Promise<MenuIntent> {
    const text = input.text.trim();
    const lower = text.toLocaleLowerCase();
    if (/(?:xem|hiện tại|đã chọn|đơn hàng|giỏ hàng|current order|my order|cart)/iu.test(text)) return intent("VIEW_DRAFT");
    if (/\b(checkout|place order|get quote|thanh toán|đặt hàng|báo giá)\b/u.test(lower)) return intent("REQUEST_QUOTE");
    if (/\b(remove|delete|bỏ|xóa)\b/u.test(lower)) return { ...intent("REMOVE_DRAFT_ITEM"), foodQuery: text.replace(/^.*?\b(?:remove|delete|bỏ|xóa)\b\s*/iu, "").trim() || null };
    if (hasDeliverySignal(text, lower)) return { ...intent("COLLECT_DELIVERY"), delivery: readDemoDelivery(text) };
    return { ...intent("SEARCH_ITEM"), foodQuery: text || null };
  }
}

export class DemoMenuResponder implements MenuResponder {
  async generate(_input: ChatAiInput, intent: MenuIntent, items: MenuSearchResult[]): Promise<string> {
    if (items.length === 0) {
      return intent.action === "COLLECT_DELIVERY"
        ? "I saved the delivery details I could identify. Please provide any missing contact or address details before checkout."
        : "Hi! I’m your KFC demo assistant. Ask me about chicken, burgers, rice, drinks, or another menu favorite.";
    }
    const suggestions = items.slice(0, 3).map((item) => `${item.name} (${formatVnd(item.price, item.currency)})`).join(", ");
    return `Here are some available KFC picks: ${suggestions}. Add or remove items, provide delivery details, then ask for checkout when you are ready.`;
  }
}

function intent(action: MenuIntent["action"]): MenuIntent {
  return { action, foodQuery: null, categoryQuery: null, itemType: null, quantity: null, preferences: [], preferenceUpdates: { excludeItemTypes: [], includeItemTypes: [] }, referencedSelection: null, delivery: null, confirmationPhrase: null, needsClarification: false, clarificationQuestion: null };
}

function readDemoDelivery(text: string): MenuIntent["delivery"] {
  const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u)?.[0];
  const phone = text.match(/(?:\+?84|0)\d{9,10}/u)?.[0];
  const recipientName = text.match(/(?:my name is|name is|tên(?: tôi)? là)\s+(.+)/iu)?.[1]?.trim();
  const city = text.match(/(?:city(?: is)?|thành phố(?: là)?)\s+(.+)/iu)?.[1]?.trim();
  const ward = text.match(/(?:ward|phường)\s+(.+)/iu)?.[1]?.trim();
  const district = text.match(/(?:district|quận)\s+(.+)/iu)?.[1]?.trim();
  const address = text.match(/(?:deliver to|delivery|address(?: is)?|giao đến|địa chỉ(?: là)?)\s*:?\s*(.+)/iu)?.[1]?.trim();
  return {
    ...(email ? { email } : {}),
    ...(recipientName ? { recipientName } : {}),
    ...(phone ? { phone } : {}),
    ...(address ? { addressLine: address } : {}),
    ...(city ? { city } : {}),
    ...(ward ? { ward } : {}),
    ...(district ? { district } : {}),
  };
}

function hasDeliverySignal(text: string, lower: string): boolean {
  return /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u.test(text)
    || /(?:\+?84|0)\d{9,10}/u.test(text)
    || /\b(?:deliver|delivery|address|city|ward|district|phone)\b/u.test(lower)
    || /(?:my name is|name is|giao đến|địa chỉ|thành phố|phường|quận|tên(?: tôi)? là)/u.test(lower);
}

function formatVnd(price: number, currency: string): string {
  return `${new Intl.NumberFormat("vi-VN").format(price)} ${currency}`;
}
