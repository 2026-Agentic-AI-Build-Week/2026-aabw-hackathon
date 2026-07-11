import type { ChatAiInput } from "./ai-client.js";
import type { MenuIntent } from "./menu-intent.js";
import type { MenuResponder } from "./ordering-agent.js";
import type { MenuSearchResult } from "./menu-search.js";

export class ValidatedMenuResponder implements MenuResponder {
  async generate(_input: ChatAiInput, intent: MenuIntent, results: MenuSearchResult[]): Promise<string> {
    if (intent.action === "GREETING") {
      return "Hi! Welcome to KFC. What would you like to order today?";
    }
    if (results.length === 0) {
      const hasExclusions = intent.preferenceUpdates.excludeItemTypes.length > 0;
      return hasExclusions
        ? "I could not find an item matching your current preferences. Try another type or remove a restriction."
        : "I could not find a matching item currently offered on the menu. Try another item or ask to browse the menu.";
    }

    if (intent.action === "REFINE_SELECTION" && results[0]) {
      const quantity = intent.quantity ?? 1;
      return `Selected ${quantity} ${results[0].name} (${formatPrice(results[0])}). Would you like another item or proceed to checkout?`;
    }

    const options = results.slice(0, 5).map((item, index) => `${index + 1}. ${item.name} (${formatPrice(item)})`).join("\n");
    if (intent.action === "BROWSE_MENU") {
      return `Here are available menu items:\n${options}\nReply with an item number or name.`;
    }
    return `I found these matching available items:\n${options}\nWhich item and quantity would you like?`;
  }
}

function formatPrice(item: MenuSearchResult): string {
  const amount = new Intl.NumberFormat("vi-VN").format(item.price);
  return item.currency === "VND" ? `${amount}đ` : `${amount} ${item.currency}`;
}
