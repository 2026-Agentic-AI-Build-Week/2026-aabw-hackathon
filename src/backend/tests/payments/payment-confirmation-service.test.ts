import { describe, expect, it, vi } from "vitest";
import { PaymentConfirmationError, PaymentConfirmationService, type PaymentConfirmationRepository } from "../../src/payments/payment-confirmation-service.js";

function createRepository(overrides: Partial<PaymentConfirmationRepository> = {}): PaymentConfirmationRepository {
  return {
    findOrder: vi.fn(),
    confirmOrder: vi.fn(),
    createBotMessage: vi.fn(),
    ...overrides,
  };
}

describe("PaymentConfirmationService", () => {
  it("confirms a created QR order and creates the success message", async () => {
    const repository = createRepository({
      findOrder: vi.fn().mockResolvedValue({ id: "order-1", sessionId: "session-1", status: "CREATED", paymentMethod: "QR_TRANSFER" }),
      confirmOrder: vi.fn().mockResolvedValue({ id: "order-1", sessionId: "session-1", status: "CONFIRMED", paidAt: new Date("2026-07-12T12:00:00.000Z") }),
      createBotMessage: vi.fn().mockResolvedValue({ id: "message-1", createdAt: new Date("2026-07-12T12:00:00.000Z") }),
    });
    const service = new PaymentConfirmationService(repository);

    const result = await service.confirm("order-1");

    expect(repository.confirmOrder).toHaveBeenCalledWith("order-1");
    expect(repository.createBotMessage).toHaveBeenCalledWith("session-1", "Payment successful. Enjoy your meal!");
    expect(result).toMatchObject({ confirmed: true, message: { id: "message-1", text: "Payment successful. Enjoy your meal!", sender: "bot" } });
  });

  it("returns an idempotent result without another message for confirmed orders", async () => {
    const repository = createRepository({
      findOrder: vi.fn().mockResolvedValue({ id: "order-1", sessionId: "session-1", status: "CONFIRMED", paymentMethod: "QR_TRANSFER" }),
    });
    const service = new PaymentConfirmationService(repository);

    const result = await service.confirm("order-1");

    expect(result).toEqual({ confirmed: false });
    expect(repository.confirmOrder).not.toHaveBeenCalled();
    expect(repository.createBotMessage).not.toHaveBeenCalled();
  });

  it("rejects non-QR and cancelled orders", async () => {
    const repository = createRepository({
      findOrder: vi.fn()
        .mockResolvedValueOnce({ id: "order-1", sessionId: "session-1", status: "CREATED", paymentMethod: "COD" })
        .mockResolvedValueOnce({ id: "order-2", sessionId: "session-1", status: "CANCELLED", paymentMethod: "QR_TRANSFER" }),
    });
    const service = new PaymentConfirmationService(repository);

    await expect(service.confirm("order-1")).rejects.toEqual(new PaymentConfirmationError("PAYMENT_METHOD_INVALID", "Only QR transfer orders can be confirmed.", 409));
    await expect(service.confirm("order-2")).rejects.toEqual(new PaymentConfirmationError("ORDER_NOT_PAYABLE", "Order cannot be confirmed from its current status.", 409));
  });
});
