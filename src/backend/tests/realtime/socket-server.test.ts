import { describe, expect, it, vi } from "vitest";
import { createSocketChatEmitter } from "../../src/realtime/socket-server.js";
import type { ServerToClientEvents } from "../../src/realtime/chat-events.js";

describe("createSocketChatEmitter", () => {
  it("maps safe checkout updates directly to checkout_update", () => {
    const emit = vi.fn();
    const emitter = createSocketChatEmitter({ emit: <Event extends keyof ServerToClientEvents>(event: Event, payload: Parameters<ServerToClientEvents[Event]>[0]) => emit(event, payload) });
    const payload = { session_id: "session-1", checkout: { state: "order_created" as const, order: { orderId: "order-1", status: "CREATED" as const, total: 100000, currency: "VND", createdAt: "2026-07-12T12:00:00.000Z" } } };

    emitter.checkout(payload);

    expect(emit).toHaveBeenCalledWith("checkout_update", payload);
    expect(JSON.stringify(emit.mock.calls)).not.toContain("confirmationToken");
  });
});
