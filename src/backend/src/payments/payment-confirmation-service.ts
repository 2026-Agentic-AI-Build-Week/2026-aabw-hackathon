import type { PrismaClient } from "@prisma/client";

export const paymentSuccessMessage = "Payment successful. Enjoy your meal!";

type PayableOrder = {
  id: string;
  paymentMethod: "COD" | "QR_TRANSFER";
  sessionId: string;
  status: "CREATED" | "CONFIRMED" | "PREPARING" | "DELIVERING" | "COMPLETED" | "CANCELLED";
};

type ConfirmedOrder = { id: string; sessionId: string; status: "CONFIRMED"; paidAt: Date | null };
type CreatedMessage = { id: string; createdAt: Date };

export interface PaymentConfirmationRepository {
  findOrder(orderId: string): Promise<PayableOrder | null>;
  confirmOrder(orderId: string): Promise<ConfirmedOrder>;
  createBotMessage(sessionId: string, text: string): Promise<CreatedMessage>;
}

export class PaymentConfirmationError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode: number) {
    super(message);
  }
}

export class PaymentConfirmationService {
  constructor(private readonly repository: PaymentConfirmationRepository) {}

  async confirm(orderId: string): Promise<{ confirmed: boolean; sessionId?: string; message?: { id: string; client_message_id: null; text: string; sender: "bot"; timestamp: string; status: "sent" } }> {
    const order = await this.repository.findOrder(orderId);
    if (!order) throw new PaymentConfirmationError("ORDER_NOT_FOUND", "Order was not found.", 404);
    if (order.paymentMethod !== "QR_TRANSFER") throw new PaymentConfirmationError("PAYMENT_METHOD_INVALID", "Only QR transfer orders can be confirmed.", 409);
    if (order.status === "CONFIRMED") return { confirmed: false };
    if (order.status !== "CREATED") throw new PaymentConfirmationError("ORDER_NOT_PAYABLE", "Order cannot be confirmed from its current status.", 409);
    const confirmedOrder = await this.repository.confirmOrder(orderId);
    const message = await this.repository.createBotMessage(confirmedOrder.sessionId, paymentSuccessMessage);
    return { confirmed: true, sessionId: confirmedOrder.sessionId, message: { id: message.id, client_message_id: null, text: paymentSuccessMessage, sender: "bot", timestamp: message.createdAt.toISOString(), status: "sent" } };
  }
}

export class PrismaPaymentConfirmationRepository implements PaymentConfirmationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOrder(orderId: string): Promise<PayableOrder | null> {
    return this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, paymentMethod: true, sessionId: true, status: true } });
  }

  async confirmOrder(orderId: string): Promise<ConfirmedOrder> {
    return this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.update({ where: { id: orderId }, data: { status: "CONFIRMED", paidAt: new Date(), statusHistory: { create: { fromStatus: "CREATED", toStatus: "CONFIRMED", actor: "payment_callback" } } }, select: { id: true, sessionId: true, status: true, paidAt: true } });
      return { ...order, status: "CONFIRMED" };
    });
  }

  async createBotMessage(sessionId: string, text: string): Promise<CreatedMessage> {
    return this.prisma.conversationMessage.create({ data: { sessionId, direction: "OUTBOUND", role: "ASSISTANT", redactedContent: text }, select: { id: true, createdAt: true } });
  }
}
