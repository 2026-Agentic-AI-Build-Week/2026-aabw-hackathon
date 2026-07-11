import { createHash, randomBytes } from "node:crypto";
import type { OrderStatus, PrismaClient } from "@prisma/client";
import { normalizeEmail, normalizeVietnamPhone } from "../lib/normalization.js";
import type { QuoteInput } from "./order-input.js";

export class OrderError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode: number) { super(message); }
}

const orderInclude = { items: { include: { modifiers: true } }, deliveryDetail: true, statusHistory: { orderBy: { createdAt: "asc" as const } } };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export class OrderService {
  constructor(private readonly prisma: PrismaClient, private readonly now = () => new Date()) {}

  async createQuote(userId: string, input: QuoteInput) {
    const session = await this.prisma.conversationSession.findFirst({ where: { id: input.sessionId, userId } });
    if (!session) throw new OrderError("SESSION_NOT_FOUND", "Conversation session was not found.", 404);
    const quotedItems = [];
    for (const inputItem of input.items) {
      const item = await this.prisma.menuItem.findFirst({ where: { id: inputItem.menuItemId, isAvailable: true }, include: { modifierGroups: { include: { modifierGroup: { include: { options: true } } } } } });
      if (!item) throw new OrderError("VALIDATION_ERROR", "A menu item is unavailable.", 400);
      const allowedOptions = new Map(item.modifierGroups.flatMap((link) => link.modifierGroup.options).filter((option) => option.isAvailable).map((option) => [option.id, option]));
      const modifiers = inputItem.modifiers.map((requested) => {
        const option = allowedOptions.get(requested.modifierOptionId);
        if (!option) throw new OrderError("VALIDATION_ERROR", "A modifier is invalid for the selected menu item.", 400);
        return { name: option.name, priceDelta: option.priceDelta, quantity: requested.quantity };
      });
      const modifierTotal = modifiers.reduce((sum, modifier) => sum + modifier.priceDelta * modifier.quantity, 0);
      quotedItems.push({ menuItemId: item.id, itemName: item.name, quantity: inputItem.quantity, unitPrice: item.price, modifierTotal, lineTotal: (item.price + modifierTotal) * inputItem.quantity, modifiers });
    }
    const subtotal = quotedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    let discountAmount = 0;
    if (input.voucherCode) {
      const voucher = await this.prisma.voucherCode.findUnique({ where: { code: input.voucherCode }, include: { campaign: true } });
      const current = this.now();
      if (!voucher || voucher.status !== "ACTIVE" || voucher.campaign.status !== "ACTIVE" || voucher.campaign.startsAt > current || voucher.campaign.endsAt < current || (voucher.assignedUserId && voucher.assignedUserId !== userId) || subtotal < voucher.campaign.minimumOrderValue) throw new OrderError("VALIDATION_ERROR", "Voucher is invalid.", 400);
      discountAmount = voucher.campaign.discountType === "FIXED" ? voucher.campaign.discountValue : Math.floor(subtotal * voucher.campaign.discountValue / 100);
      if (voucher.campaign.maxDiscount !== null) discountAmount = Math.min(discountAmount, voucher.campaign.maxDiscount);
      discountAmount = Math.min(discountAmount, subtotal);
    }
    const confirmationToken = randomBytes(24).toString("base64url");
    const expiresAt = new Date(this.now().getTime() + 15 * 60 * 1000);
    const quote = await this.prisma.orderQuote.create({ data: {
      userId, sessionId: input.sessionId, voucherCode: input.voucherCode, subtotal, discountAmount, total: subtotal - discountAmount, confirmationTokenHash: hash(confirmationToken), expiresAt,
      items: { create: quotedItems.map((item) => ({ menuItemId: item.menuItemId, itemName: item.itemName, quantity: item.quantity, unitPrice: item.unitPrice, modifierTotal: item.modifierTotal, lineTotal: item.lineTotal, modifiers: { create: item.modifiers } })) },
      deliveryDetail: { create: { emailSnapshot: normalizeEmail(input.delivery.email), recipientName: input.delivery.recipientName, phoneSnapshot: input.delivery.phone, phoneNormalized: normalizeVietnamPhone(input.delivery.phone), addressLine: input.delivery.addressLine, ward: input.delivery.ward, district: input.delivery.district, city: input.delivery.city } },
    }, include: { items: { include: { modifiers: true } }, deliveryDetail: true } });
    return { quote_id: quote.id, subtotal: quote.subtotal, discount_amount: quote.discountAmount, delivery_fee: quote.deliveryFee, total: quote.total, currency: quote.currency, expires_at: quote.expiresAt.toISOString(), confirmation_token: confirmationToken, items: quote.items };
  }

  async createOrder(userId: string, quoteId: string, confirmationToken: string, idempotencyKey: string) {
    const existing = await this.prisma.order.findUnique({ where: { idempotencyKey }, include: orderInclude });
    if (existing) {
      if (existing.userId !== userId || existing.quoteId !== quoteId) throw new OrderError("IDEMPOTENCY_CONFLICT", "Idempotency key was used for another request.", 409);
      return { order: existing, created: false };
    }
    return this.prisma.$transaction(async (transaction) => {
      const quote = await transaction.orderQuote.findFirst({ where: { id: quoteId, userId }, include: { session: true, items: { include: { modifiers: true } }, deliveryDetail: true, order: true } });
      if (!quote) throw new OrderError("QUOTE_NOT_FOUND", "Order quote was not found.", 404);
      if (quote.order || quote.status === "CONSUMED") throw new OrderError("QUOTE_CONSUMED", "Order quote was already consumed.", 409);
      if (quote.status !== "ACTIVE" || quote.expiresAt <= this.now()) throw new OrderError("QUOTE_EXPIRED", "Order quote has expired.", 409);
      if (hash(confirmationToken) !== quote.confirmationTokenHash) throw new OrderError("INVALID_CONFIRMATION_TOKEN", "Confirmation token is invalid.", 409);
      if (!quote.deliveryDetail) throw new OrderError("VALIDATION_ERROR", "Quote delivery detail is missing.", 400);
      for (const item of quote.items) {
        if (!item.menuItemId) continue;
        const result = await transaction.menuItem.updateMany({
          where: { id: item.menuItemId, isAvailable: true, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (result.count !== 1) throw new OrderError("INSUFFICIENT_STOCK", "A menu item does not have enough stock.", 409);
      }
      const order = await transaction.order.create({ data: {
        orderNumber: `KFC-${this.now().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`,
        userId, sessionId: quote.sessionId, quoteId: quote.id, paymentMethod: "QR_TRANSFER", paymentQrCode: `KFCQR-${randomBytes(12).toString("hex").toUpperCase()}`, subtotal: quote.subtotal, discountAmount: quote.discountAmount, deliveryFee: quote.deliveryFee, total: quote.total, currency: quote.currency, voucherCodeSnapshot: quote.voucherCode, idempotencyKey, channelSnapshot: quote.session.channel,
        items: { create: quote.items.map((item) => ({ menuItemId: item.menuItemId, itemName: item.itemName, quantity: item.quantity, unitPrice: item.unitPrice, modifierTotal: item.modifierTotal, lineTotal: item.lineTotal, modifiers: { create: item.modifiers.map((modifier) => ({ name: modifier.name, priceDelta: modifier.priceDelta, quantity: modifier.quantity })) } })) },
        deliveryDetail: { create: { emailSnapshot: quote.deliveryDetail.emailSnapshot, recipientName: quote.deliveryDetail.recipientName, phoneSnapshot: quote.deliveryDetail.phoneSnapshot, phoneNormalized: quote.deliveryDetail.phoneNormalized, addressLine: quote.deliveryDetail.addressLine, ward: quote.deliveryDetail.ward, district: quote.deliveryDetail.district, city: quote.deliveryDetail.city } },
        statusHistory: { create: { toStatus: "CREATED", actor: `user:${userId}` } },
      }, include: orderInclude });
      await transaction.orderQuote.update({ where: { id: quote.id }, data: { status: "CONSUMED" } });
      return { order, created: true };
    });
  }

  async listOrders(userId: string, page: number, pageSize: number, status?: OrderStatus) {
    const where = { userId, ...(status ? { status } : {}) };
    const [data, total] = await this.prisma.$transaction([this.prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { items: true } }), this.prisma.order.count({ where })]);
    return { data, pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) } };
  }

  async getOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, include: orderInclude });
    if (!order) throw new OrderError("ORDER_NOT_FOUND", "Order was not found.", 404);
    return order;
  }

  async updateDelivery(userId: string, orderId: string, delivery: QuoteInput["delivery"]) {
    const order = await this.getOrder(userId, orderId);
    if (order.status !== "CREATED") throw new OrderError("ORDER_NOT_EDITABLE", "Order delivery can no longer be changed.", 409);
    await this.prisma.orderDeliveryDetail.update({ where: { orderId }, data: { emailSnapshot: normalizeEmail(delivery.email), recipientName: delivery.recipientName, phoneSnapshot: delivery.phone, phoneNormalized: normalizeVietnamPhone(delivery.phone), addressLine: delivery.addressLine, ward: delivery.ward, district: delivery.district, city: delivery.city } });
    return this.getOrder(userId, orderId);
  }

  async cancelOrder(userId: string, orderId: string, reason?: string) {
    const order = await this.getOrder(userId, orderId);
    if (order.status === "CANCELLED") return order;
    if (order.status !== "CREATED" && order.status !== "CONFIRMED") throw new OrderError("ORDER_NOT_CANCELLABLE", "Order can no longer be cancelled.", 409);
    await this.prisma.$transaction([this.prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } }), this.prisma.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: "CANCELLED", actor: `user:${userId}`, reason } })]);
    return this.getOrder(userId, orderId);
  }
}
