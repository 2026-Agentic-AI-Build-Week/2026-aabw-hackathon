import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuthApplication } from "../../src/http/app.js";
import { InMemoryAuthRepository } from "../../src/auth/in-memory-auth-repository.js";
import { createAuthTestDependencies } from "../auth/test-helpers.js";

const servers: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("payment confirmation callback", () => {
  it("requires its configured callback secret", async () => {
    const application = await createAuthApplication(createAuthTestDependencies(new InMemoryAuthRepository()), undefined, { paymentCallbackSecret: "payment-secret", payments: { confirm: vi.fn() } }).listen(0);
    servers.push(application);

    const response = await application.request("/payments/confirm", { method: "POST", body: { orderId: "order-1" } });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("confirms a payment once and notifies the chat emitter", async () => {
    const confirm = vi.fn().mockResolvedValue({ confirmed: true, sessionId: "session-1", message: { id: "message-1", text: "Payment successful. Enjoy your meal!", sender: "bot", timestamp: "2026-07-12T12:00:00.000Z" } });
    const notifyPaymentMessage = vi.fn();
    const application = await createAuthApplication(createAuthTestDependencies(new InMemoryAuthRepository()), undefined, { paymentCallbackSecret: "payment-secret", payments: { confirm }, notifyPaymentMessage }).listen(0);
    servers.push(application);

    const response = await application.request("/payments/confirm", { method: "POST", headers: { "x-payment-callback-secret": "payment-secret" }, body: { orderId: "order-1" } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ order_id: "order-1", confirmed: true });
    expect(confirm).toHaveBeenCalledWith("order-1");
    expect(notifyPaymentMessage).toHaveBeenCalledWith("session-1", expect.objectContaining({ id: "message-1" }));
  });
});
