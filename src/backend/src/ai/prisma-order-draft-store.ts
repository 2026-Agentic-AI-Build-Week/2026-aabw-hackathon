import type { PrismaClient } from "@prisma/client";
import type { DeliveryDraft, PendingCheckout } from "./checkout-types.js";
import type { ConversationLanguage } from "./conversation-language.js";
import { createEmptyOrderDraft, type OrderDraft, type OrderDraftItem } from "./order-draft.js";
import { sanitizeMenuItemTypes } from "./menu-intent.js";
import type { MenuSearchResult } from "./menu-search.js";
import type { OrderDraftStore } from "./ordering-agent.js";

export class PrismaOrderDraftStore implements OrderDraftStore {
  constructor(private readonly prisma: PrismaClient) {}

  async load(sessionId: string): Promise<OrderDraft> {
    const session = await this.prisma.conversationSession.findUnique({ where: { id: sessionId }, select: { draftState: true } });
    return parseOrderDraft(session?.draftState);
  }

  async save(sessionId: string, draft: OrderDraft): Promise<void> {
    await this.prisma.conversationSession.update({ where: { id: sessionId }, data: { draftState: draft } });
  }
}

export function parseOrderDraft(value: unknown): OrderDraft {
  const record = readRecord(value);
  if (!record || !Array.isArray(record.items)) return createEmptyOrderDraft();
  const items = parseItems(record.items);
  if (items.length !== record.items.length) return createEmptyOrderDraft();

  return {
    responseLanguage: parseResponseLanguage(record.responseLanguage),
    items,
    preferences: readStrings(record.preferences),
    menuPreferences: parseMenuPreferences(record.menuPreferences),
    unresolvedFields: readStrings(record.unresolvedFields),
    suggestions: parseSuggestions(record.suggestions),
    delivery: parseDelivery(record.delivery),
    voucherCode: readNonEmptyString(record.voucherCode),
    pendingCheckout: parsePendingCheckout(record.pendingCheckout),
  };
}

function parseResponseLanguage(value: unknown): ConversationLanguage | null {
  return value === "vi" || value === "en" ? value : null;
}

function parseMenuPreferences(value: unknown): OrderDraft["menuPreferences"] {
  const record = readRecord(value);
  return { excludedItemTypes: sanitizeMenuItemTypes(record?.excludedItemTypes) };
}

function parseItems(value: unknown[]): OrderDraftItem[] {
  return value.flatMap((item) => {
    const row = readRecord(item);
    if (!row || !isPositiveInteger(row.quantity)) return [];
    const menuItemId = readNonEmptyString(row.menuItemId);
    const name = readNonEmptyString(row.name);
    return menuItemId && name ? [{ menuItemId, name, quantity: row.quantity }] : [];
  });
}

function parseSuggestions(value: unknown): MenuSearchResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = readRecord(item);
    if (!row || typeof row.id !== "string" || typeof row.name !== "string" || typeof row.slug !== "string" || typeof row.itemType !== "string" || typeof row.price !== "number" || typeof row.currency !== "string") return [];
    return [{ id: row.id, name: row.name, slug: row.slug, itemType: row.itemType, description: typeof row.description === "string" ? row.description : null, price: row.price, currency: row.currency, categories: readStrings(row.categories), score: typeof row.score === "number" ? row.score : 0 }];
  });
}

function parseDelivery(value: unknown): DeliveryDraft | null {
  const record = readRecord(value);
  if (!record) return null;
  const delivery: DeliveryDraft = {};
  for (const key of ["email", "recipientName", "phone", "addressLine", "ward", "district", "city"] as const) {
    const parsed = readNonEmptyString(record[key]);
    if (parsed) delivery[key] = parsed;
  }
  return Object.keys(delivery).length > 0 ? delivery : null;
}

function parsePendingCheckout(value: unknown): PendingCheckout | null {
  const record = readRecord(value);
  if (!record) return null;
  const quoteId = readNonEmptyString(record.quoteId);
  const confirmationToken = readNonEmptyString(record.confirmationToken);
  const confirmationPhrase = readNonEmptyString(record.confirmationPhrase);
  const expiresAt = readNonEmptyString(record.expiresAt);
  const idempotencyKey = readNonEmptyString(record.idempotencyKey);
  return quoteId && confirmationToken && confirmationPhrase && expiresAt && isIsoUtcTimestamp(expiresAt) && idempotencyKey
    ? { quoteId, confirmationToken, confirmationPhrase, expiresAt, idempotencyKey }
    : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isIsoUtcTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}
