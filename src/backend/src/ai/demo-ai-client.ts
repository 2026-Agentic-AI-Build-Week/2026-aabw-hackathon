import type { ChatAi, ChatAiInput } from "./ai-client.js";
import type { MenuSearch } from "./menu-search.js";

export class DemoAiClient implements ChatAi {
  constructor(private readonly menuSearch: MenuSearch) {}

  async respond(input: ChatAiInput): Promise<string> {
    const items = await this.menuSearch.search(input.text);
    if (items.length === 0) {
      return "Hi! I’m your KFC demo assistant. Ask me about chicken, burgers, rice, drinks, or another menu favorite.";
    }
    const suggestions = items.slice(0, 3).map((item) => `${item.name} (${formatVnd(item.price, item.currency)})`).join(", ");
    return `Here are some available KFC picks: ${suggestions}. I can help you explore the menu, but I won’t place an order without a separate confirmed checkout flow.`;
  }
}

function formatVnd(price: number, currency: string): string {
  return `${new Intl.NumberFormat("vi-VN").format(price)} ${currency}`;
}
