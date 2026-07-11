import type { PrismaClient } from "@prisma/client";
import { parseOrderDraft } from "../ai/prisma-order-draft-store.js";
import type { ChatRepository } from "./chat-handler.js";

export class PrismaChatRepository implements ChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreateSession(userId: string) {
    return this.prisma.conversationSession.upsert({
      where: { sessionKey: `web:${userId}` },
      update: { userId, lastActivityAt: new Date() },
      create: { sessionKey: `web:${userId}`, channel: "WEB", userId },
      select: { id: true, sessionKey: true },
    });
  }

  async listMessages(sessionId: string) {
    const messages = await this.prisma.conversationMessage.findMany({
      where: { sessionId, role: { in: ["USER", "ASSISTANT"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, role: true, redactedContent: true, externalMessageId: true, createdAt: true },
    });
    return messages.map((message) => ({ id: message.id, client_message_id: message.externalMessageId, text: message.redactedContent, sender: message.role === "USER" ? "user" as const : "bot" as const, timestamp: message.createdAt.toISOString(), status: "sent" as const }));
  }

  async getCheckout(sessionId: string) {
    const order = await this.prisma.order.findFirst({
      where: { sessionId, paymentQrCode: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, total: true, currency: true, createdAt: true, paymentQrCode: true },
    });
    if (order?.paymentQrCode) {
      return { state: "order_created" as const, order: { orderId: order.id, status: order.status, total: order.total, currency: order.currency, createdAt: order.createdAt.toISOString(), paymentQrCode: order.paymentQrCode } };
    }

    const session = await this.prisma.conversationSession.findUnique({ where: { id: sessionId }, select: { draftState: true } });
    const pending = parseOrderDraft(session?.draftState).pendingCheckout;
    if (!pending) return null;
    const quote = await this.prisma.orderQuote.findUnique({ where: { id: pending.quoteId }, include: { items: true } });
    if (!quote) return null;
    return { state: "quote_ready" as const, quote: { quoteId: quote.id, subtotal: quote.subtotal, discountAmount: quote.discountAmount, deliveryFee: quote.deliveryFee, total: quote.total, currency: quote.currency, expiresAt: quote.expiresAt.toISOString(), confirmationPhrase: pending.confirmationPhrase, items: quote.items.map((item) => ({ menuItemId: item.menuItemId ?? "", itemName: item.itemName, quantity: item.quantity, unitPrice: item.unitPrice, modifierTotal: item.modifierTotal, lineTotal: item.lineTotal })) } };
  }

  async findMessageByExternalId(sessionId: string, externalMessageId: string) {
    return this.prisma.conversationMessage.findUnique({ where: { sessionId_externalMessageId: { sessionId, externalMessageId } }, select: { id: true, createdAt: true } });
  }

  async createMessage(input: Parameters<ChatRepository["createMessage"]>[0]) {
    return this.prisma.conversationMessage.create({ data: input, select: { id: true, createdAt: true } });
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.prisma.conversationSession.update({ where: { id: sessionId }, data: { lastActivityAt: new Date() } });
  }
}
