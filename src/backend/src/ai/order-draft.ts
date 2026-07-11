import type { DeliveryDraft, PendingCheckout } from "./checkout-types.js";
import type { ConversationLanguage } from "./conversation-language.js";
import type { MenuIntent, MenuItemType, MenuPreferenceUpdates } from "./menu-intent.js";
import type { MenuSearchResult } from "./menu-search.js";

export type OrderDraftItem = { menuItemId: string; name: string; quantity: number };

export type OrderDraft = {
  responseLanguage: ConversationLanguage | null;
  items: OrderDraftItem[];
  preferences: string[];
  menuPreferences: { excludedItemTypes: MenuItemType[] };
  unresolvedFields: string[];
  suggestions?: MenuSearchResult[];
  delivery?: DeliveryDraft | null;
  voucherCode?: string | null;
  pendingCheckout?: PendingCheckout | null;
};

export function createEmptyOrderDraft(): OrderDraft {
  return {
    responseLanguage: null,
    items: [],
    preferences: [],
    menuPreferences: { excludedItemTypes: [] },
    unresolvedFields: [],
    suggestions: [],
    delivery: null,
    voucherCode: null,
    pendingCheckout: null,
  };
}

export function withResponseLanguage(draft: OrderDraft, language: ConversationLanguage): OrderDraft {
  return draft.responseLanguage ? draft : { ...draft, responseLanguage: language };
}

export function applyMenuPreferenceUpdate(draft: OrderDraft, update: MenuPreferenceUpdates): OrderDraft {
  const included = new Set(update.includeItemTypes);
  const retained = draft.menuPreferences.excludedItemTypes.filter((itemType) => !included.has(itemType));
  const excludedItemTypes = [...new Set([...retained, ...update.excludeItemTypes])];
  const unchanged = excludedItemTypes.length === draft.menuPreferences.excludedItemTypes.length
    && excludedItemTypes.every((itemType, index) => itemType === draft.menuPreferences.excludedItemTypes[index]);
  if (unchanged) return draft;
  return { ...draft, menuPreferences: { excludedItemTypes }, pendingCheckout: null };
}

export function updateOrderDraft(draft: OrderDraft, intent: MenuIntent, results: MenuSearchResult[]): OrderDraft {
  if (intent.action === "UPDATE_PREFERENCES") {
    return applyMenuPreferenceUpdate(draft, intent.preferenceUpdates);
  }

  if (intent.action === "COLLECT_DELIVERY" && intent.delivery) {
    return applyDeliveryUpdate(draft, intent.delivery);
  }

  const selected = results[0];
  const quantity = intent.quantity ?? (intent.action === "REFINE_SELECTION" ? 1 : null);
  if (!selected || !quantity || (intent.action !== "SEARCH_ITEM" && intent.action !== "REFINE_SELECTION")) {
    return { ...draft, suggestions: results.slice(0, 8) };
  }

  return applyMenuSelection(draft, selected, quantity, intent.preferences, results);
}

export function applyMenuSelection(
  draft: OrderDraft,
  selected: MenuSearchResult,
  quantity: number,
  preferences: string[],
  results: MenuSearchResult[] = [selected],
): OrderDraft {
  const existing = draft.items.find((item) => item.menuItemId === selected.id);
  const itemChanged = !existing || existing.quantity !== quantity || existing.name !== selected.name;
  const items = existing
    ? draft.items.map((item) => item.menuItemId === selected.id ? { ...item, name: selected.name, quantity } : item)
    : [...draft.items, { menuItemId: selected.id, name: selected.name, quantity }];
  const mergedPreferences = [...new Set([...draft.preferences, ...preferences])];
  const preferencesChanged = mergedPreferences.length !== draft.preferences.length;

  return {
    ...draft,
    items,
    preferences: mergedPreferences,
    unresolvedFields: [],
    suggestions: results.slice(0, 8),
    pendingCheckout: itemChanged || preferencesChanged ? null : draft.pendingCheckout ?? null,
  };
}

export function applyDeliveryUpdate(draft: OrderDraft, update: DeliveryDraft): OrderDraft {
  const delivery = { ...(draft.delivery ?? {}), ...update };
  if (sameDelivery(draft.delivery ?? {}, delivery)) return draft;
  return { ...draft, delivery, pendingCheckout: null };
}

export function applyVoucherCode(draft: OrderDraft, voucherCode: string | null): OrderDraft {
  const normalized = voucherCode?.trim() || null;
  if ((draft.voucherCode ?? null) === normalized) return draft;
  return { ...draft, voucherCode: normalized, pendingCheckout: null };
}

export function removeDraftItem(draft: OrderDraft, menuItemId: string): OrderDraft {
  const items = draft.items.filter((item) => item.menuItemId !== menuItemId);
  if (items.length === draft.items.length) return draft;
  return { ...draft, items, pendingCheckout: null };
}

export function withPendingCheckout(draft: OrderDraft, pendingCheckout: PendingCheckout | null): OrderDraft {
  return { ...draft, pendingCheckout };
}

function sameDelivery(left: DeliveryDraft, right: DeliveryDraft): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)] as Array<keyof DeliveryDraft>);
  return [...keys].every((key) => left[key] === right[key]);
}
