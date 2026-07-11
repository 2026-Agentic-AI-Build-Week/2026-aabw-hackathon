import type { MenuIntent } from "./menu-intent.js";
import type { MenuSearchResult } from "./menu-search.js";

export type OrderDraft = { items: Array<{ menuItemId: string; name: string; quantity: number }>; preferences: string[]; unresolvedFields: string[] };

export function updateOrderDraft(draft: OrderDraft, intent: MenuIntent, results: MenuSearchResult[]): OrderDraft {
  const selected = results[0];
  if (!selected || !intent.quantity || (intent.action !== "SEARCH_ITEM" && intent.action !== "REFINE_SELECTION")) return draft;
  const existing = draft.items.find((item) => item.menuItemId === selected.id);
  const items = existing
    ? draft.items.map((item) => item.menuItemId === selected.id ? { ...item, quantity: intent.quantity! } : item)
    : [...draft.items, { menuItemId: selected.id, name: selected.name, quantity: intent.quantity }];
  return { items, preferences: [...new Set([...draft.preferences, ...intent.preferences])], unresolvedFields: intent.needsClarification ? ["clarification"] : [] };
}
