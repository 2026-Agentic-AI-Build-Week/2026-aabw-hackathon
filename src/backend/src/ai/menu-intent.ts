export type MenuIntentAction = "BROWSE_MENU" | "SEARCH_ITEM" | "REFINE_SELECTION" | "ASK_CLARIFICATION" | "UNSUPPORTED";

export type MenuIntent = {
  action: MenuIntentAction;
  foodQuery: string | null;
  categoryQuery: string | null;
  itemType: string | null;
  quantity: number | null;
  preferences: string[];
  referencedSelection: "CURRENT" | "PREVIOUS" | null;
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
    referencedSelection: record.referenced_selection === "CURRENT" || record.referenced_selection === "PREVIOUS" ? record.referenced_selection : null,
    needsClarification,
    clarificationQuestion: needsClarification ? readString(record.clarification_question) : null,
  };
}

function fallbackIntent(text: string): MenuIntent {
  return { action: "SEARCH_ITEM", foodQuery: text.trim() || null, categoryQuery: null, itemType: null, quantity: null, preferences: [], referencedSelection: null, needsClarification: false, clarificationQuestion: null };
}

function readAction(value: unknown): MenuIntentAction | null {
  return value === "BROWSE_MENU" || value === "SEARCH_ITEM" || value === "REFINE_SELECTION" || value === "ASK_CLARIFICATION" || value === "UNSUPPORTED" ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readQuantity(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100 ? value : null;
}
