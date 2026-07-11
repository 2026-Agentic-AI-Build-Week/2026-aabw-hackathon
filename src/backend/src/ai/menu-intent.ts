import type { DeliveryDraft } from "./checkout-types.js";

export type MenuIntentAction =
  | "GREETING"
  | "BROWSE_MENU"
  | "SEARCH_ITEM"
  | "REFINE_SELECTION"
  | "UPDATE_PREFERENCES"
  | "REMOVE_DRAFT_ITEM"
  | "VIEW_DRAFT"
  | "COLLECT_DELIVERY"
  | "REQUEST_QUOTE"
  | "CONFIRM_ORDER"
  | "ASK_CLARIFICATION"
  | "UNSUPPORTED";

export const menuItemTypes = ["combo", "food", "drink"] as const;
export type MenuItemType = typeof menuItemTypes[number];

export type MenuPreferenceUpdates = {
  excludeItemTypes: MenuItemType[];
  includeItemTypes: MenuItemType[];
};

export type MenuIntent = {
  action: MenuIntentAction;
  foodQuery: string | null;
  categoryQuery: string | null;
  itemType: string | null;
  quantity: number | null;
  preferences: string[];
  preferenceUpdates: MenuPreferenceUpdates;
  referencedSelection: "CURRENT" | "PREVIOUS" | null;
  delivery: DeliveryDraft | null;
  confirmationPhrase: string | null;
  needsClarification: boolean;
  clarificationQuestion: string | null;
};

export function parseMenuIntent(value: unknown, fallbackText = ""): MenuIntent {
  if (!value || typeof value !== "object") return fallbackIntent(fallbackText);
  const record = value as Record<string, unknown>;
  const action = readAction(record.action);
  if (!action) return fallbackIntent(fallbackText);
  const quantity = readQuantity(record.quantity);
  const needsClarification = record.needs_clarification === true;
  return {
    action,
    foodQuery: readString(record.food_query),
    categoryQuery: readString(record.category_query),
    itemType: readString(record.item_type),
    quantity,
    preferences: Array.isArray(record.preferences) ? record.preferences.filter((item): item is string => typeof item === "string" && item.trim() !== "").slice(0, 8) : [],
    preferenceUpdates: readPreferenceUpdates(record.preference_updates),
    referencedSelection: record.referenced_selection === "CURRENT" || record.referenced_selection === "PREVIOUS" ? record.referenced_selection : null,
    delivery: readDelivery(record.delivery),
    confirmationPhrase: readString(record.confirmation_phrase),
    needsClarification,
    clarificationQuestion: needsClarification ? readString(record.clarification_question) : null,
  };
}

function fallbackIntent(text: string): MenuIntent {
  return { action: "SEARCH_ITEM", foodQuery: text.trim() || null, categoryQuery: null, itemType: null, quantity: null, preferences: [], preferenceUpdates: emptyPreferenceUpdates(), referencedSelection: null, delivery: null, confirmationPhrase: null, needsClarification: false, clarificationQuestion: null };
}

function readAction(value: unknown): MenuIntentAction | null {
  return value === "GREETING"
    || value === "BROWSE_MENU"
    || value === "SEARCH_ITEM"
    || value === "REFINE_SELECTION"
    || value === "UPDATE_PREFERENCES"
    || value === "REMOVE_DRAFT_ITEM"
    || value === "VIEW_DRAFT"
    || value === "COLLECT_DELIVERY"
    || value === "REQUEST_QUOTE"
    || value === "CONFIRM_ORDER"
    || value === "ASK_CLARIFICATION"
    || value === "UNSUPPORTED"
    ? value
    : null;
}

export function isMenuItemType(value: unknown): value is MenuItemType {
  return typeof value === "string" && menuItemTypes.includes(value as MenuItemType);
}

export function sanitizeMenuItemTypes(value: unknown): MenuItemType[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isMenuItemType))];
}

function readPreferenceUpdates(value: unknown): MenuPreferenceUpdates {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyPreferenceUpdates();
  const record = value as Record<string, unknown>;
  return {
    excludeItemTypes: sanitizeMenuItemTypes(record.exclude_item_types),
    includeItemTypes: sanitizeMenuItemTypes(record.include_item_types),
  };
}

function emptyPreferenceUpdates(): MenuPreferenceUpdates {
  return { excludeItemTypes: [], includeItemTypes: [] };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readQuantity(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100 ? value : null;
}

function readDelivery(value: unknown): DeliveryDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const delivery: DeliveryDraft = {};
  assignString(delivery, "email", record.email);
  assignString(delivery, "recipientName", record.recipient_name);
  assignString(delivery, "phone", record.phone);
  assignString(delivery, "addressLine", record.address_line);
  assignString(delivery, "ward", record.ward);
  assignString(delivery, "district", record.district);
  assignString(delivery, "city", record.city);
  return Object.keys(delivery).length > 0 ? delivery : null;
}

function assignString<Key extends keyof DeliveryDraft>(target: DeliveryDraft, key: Key, value: unknown): void {
  const parsed = readString(value);
  if (parsed !== null) target[key] = parsed;
}
