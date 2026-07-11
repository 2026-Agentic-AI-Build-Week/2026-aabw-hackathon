import type { ChatAi, ChatAiInput } from "./ai-client.js";
import type { MenuIntent } from "./menu-intent.js";
import type { MenuIntentExtractor } from "./menu-intent-extractor.js";
import type { MenuSearch, MenuSearchResult } from "./menu-search.js";
import { type OrderDraft, updateOrderDraft } from "./order-draft.js";

export class OrderingAgent implements ChatAi {
  constructor(private readonly extractor: MenuIntentExtractor, private readonly menuSearch: MenuSearch, private readonly responder: MenuResponder, private readonly drafts?: OrderDraftStore) {}

  async respond(input: ChatAiInput): Promise<string> {
    const intent = await this.extractor.extract(input);
    if (intent.needsClarification && intent.clarificationQuestion) return intent.clarificationQuestion;
    const categories = intent.categoryQuery ? await this.menuSearch.searchCategories(intent.categoryQuery) : [];
    const results = await this.menuSearch.search({ query: intent.foodQuery ?? input.text, categoryQuery: intent.categoryQuery, itemType: intent.itemType, categoryIds: categories.map((category) => category.id), limit: 8 });
    if (this.drafts) await this.drafts.save(input.sessionId, updateOrderDraft(await this.drafts.load(input.sessionId), intent, results));
    console.info("Ordering intent processed", { action: intent.action, sessionId: input.sessionId, resultCount: results.length });
    return this.responder.generate(input, intent, results);
  }
}

export interface MenuResponder { generate(input: ChatAiInput, intent: MenuIntent, results: MenuSearchResult[]): Promise<string>; }
export interface OrderDraftStore { load(sessionId: string): Promise<OrderDraft>; save(sessionId: string, draft: OrderDraft): Promise<void>; }
