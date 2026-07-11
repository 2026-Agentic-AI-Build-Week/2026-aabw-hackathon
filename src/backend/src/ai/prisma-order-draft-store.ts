import type { PrismaClient } from "@prisma/client";
import type { OrderDraft } from "./order-draft.js";
import type { OrderDraftStore } from "./ordering-agent.js";

const emptyDraft: OrderDraft = { items: [], preferences: [], unresolvedFields: [] };

export class PrismaOrderDraftStore implements OrderDraftStore {
  constructor(private readonly prisma: PrismaClient) {}

  async load(sessionId: string): Promise<OrderDraft> {
    const session = await this.prisma.conversationSession.findUnique({ where: { id: sessionId }, select: { draftState: true } });
    return parseDraft(session?.draftState);
  }

  async save(sessionId: string, draft: OrderDraft): Promise<void> {
    await this.prisma.conversationSession.update({ where: { id: sessionId }, data: { draftState: draft } });
  }
}

function parseDraft(value: unknown): OrderDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyDraft;
  const record = value as Record<string, unknown>;
  const items = Array.isArray(record.items) ? record.items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return typeof row.menuItemId === "string" && typeof row.name === "string" && typeof row.quantity === "number" ? [{ menuItemId: row.menuItemId, name: row.name, quantity: row.quantity }] : [];
  }) : [];
  return { items, preferences: Array.isArray(record.preferences) ? record.preferences.filter((item): item is string => typeof item === "string") : [], unresolvedFields: Array.isArray(record.unresolvedFields) ? record.unresolvedFields.filter((item): item is string => typeof item === "string") : [] };
}
