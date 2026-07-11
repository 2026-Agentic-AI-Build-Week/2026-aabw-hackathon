import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { OrderError, OrderService } from "../../src/orders/order-service.js";

const confirmationToken = "confirmation-token";
const tokenHash = createHash("sha256").update(confirmationToken).digest("hex");

function createQuote(items: Array<{ menuItemId: string; quantity: number }>) {
  return {
    id: "quote-1",
    userId: "user-1",
    sessionId: "session-1",
    status: "ACTIVE",
    expiresAt: new Date("2026-07-11T12:15:00.000Z"),
    confirmationTokenHash: tokenHash,
    subtotal: 100_000,
    discountAmount: 0,
    deliveryFee: 0,
    total: 100_000,
    currency: "VND",
    voucherCode: null,
    session: { channel: "MOBILE" },
    deliveryDetail: {
      emailSnapshot: "customer@example.com",
      recipientName: "Customer",
      phoneSnapshot: "0901234567",
      phoneNormalized: "+84901234567",
      addressLine: "1 KFC Street",
      ward: null,
      district: null,
      city: "Ho Chi Minh City",
    },
    order: null,
    items: items.map((item) => ({
      ...item,
      itemName: item.menuItemId,
      unitPrice: 50_000,
      modifierTotal: 0,
      lineTotal: 50_000 * item.quantity,
      modifiers: [],
    })),
  };
}

function createPrismaMock(initialStock: Record<string, number>, quote = createQuote([{ menuItemId: "item-1", quantity: 2 }])) {
  const stockByMenuItemId = new Map(Object.entries(initialStock));
  const orderCreate = vi.fn(async () => ({ id: "order-1", userId: "user-1", quoteId: "quote-1" }));
  const quoteUpdate = vi.fn(async () => quote);
  const updateMany = vi.fn(async ({ where, data }: any) => {
    const currentStock = stockByMenuItemId.get(where.id);
    const requiredQuantity = where.stockQuantity.gte;
    if (where.isAvailable !== true || currentStock === undefined || currentStock < requiredQuantity) return { count: 0 };
    stockByMenuItemId.set(where.id, currentStock - data.stockQuantity.decrement);
    return { count: 1 };
  });
  const transaction = {
    orderQuote: { findFirst: vi.fn(async () => quote), update: quoteUpdate },
    menuItem: { updateMany },
    order: { create: orderCreate },
  };
  const prisma = {
    order: { findUnique: vi.fn(async (): Promise<any> => null) },
    $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) => {
      const snapshot = new Map(stockByMenuItemId);
      try {
        return await callback(transaction);
      } catch (error) {
        stockByMenuItemId.clear();
        for (const [menuItemId, quantity] of snapshot) stockByMenuItemId.set(menuItemId, quantity);
        throw error;
      }
    }),
  };
  return { prisma, stockByMenuItemId, updateMany, orderCreate, quoteUpdate };
}

describe("OrderService stock handling", () => {
  it("decrements menu item stock when creating an order", async () => {
    const mock = createPrismaMock({ "item-1": 3 });
    const service = new OrderService(mock.prisma as any, () => new Date("2026-07-11T12:00:00.000Z"));

    await expect(service.createOrder("user-1", "quote-1", confirmationToken, "key-1")).resolves.toMatchObject({ created: true });

    expect(mock.stockByMenuItemId.get("item-1")).toBe(1);
    expect(mock.updateMany).toHaveBeenCalledWith({
      where: { id: "item-1", isAvailable: true, stockQuantity: { gte: 2 } },
      data: { stockQuantity: { decrement: 2 } },
    });
  });

  it("rolls back all stock changes when a later item has insufficient stock", async () => {
    const quote = createQuote([
      { menuItemId: "item-1", quantity: 2 },
      { menuItemId: "item-2", quantity: 2 },
    ]);
    const mock = createPrismaMock({ "item-1": 3, "item-2": 1 }, quote);
    const service = new OrderService(mock.prisma as any, () => new Date("2026-07-11T12:00:00.000Z"));

    await expect(service.createOrder("user-1", "quote-1", confirmationToken, "key-1")).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      statusCode: 409,
    });

    expect(Object.fromEntries(mock.stockByMenuItemId)).toEqual({ "item-1": 3, "item-2": 1 });
    expect(mock.orderCreate).not.toHaveBeenCalled();
    expect(mock.quoteUpdate).not.toHaveBeenCalled();
  });

  it("does not decrement stock for an idempotent retry", async () => {
    const mock = createPrismaMock({ "item-1": 3 });
    const existingOrder = { id: "order-1", userId: "user-1", quoteId: "quote-1" };
    mock.prisma.order.findUnique.mockResolvedValue(existingOrder);
    const service = new OrderService(mock.prisma as any, () => new Date("2026-07-11T12:00:00.000Z"));

    await expect(service.createOrder("user-1", "quote-1", confirmationToken, "key-1")).resolves.toEqual({ order: existingOrder, created: false });

    expect(mock.stockByMenuItemId.get("item-1")).toBe(3);
    expect(mock.prisma.$transaction).not.toHaveBeenCalled();
    expect(mock.updateMany).not.toHaveBeenCalled();
  });
});
