import { describe, expect, it, vi } from "vitest";
import { ChatHandler, type ChatEmitter, type ChatRepository } from "../../src/realtime/chat-handler.js";
import type { ChatAi } from "../../src/ai/ai-client.js";

const session = { id: "session-1", sessionKey: "web:user-1" };
const createdUserMessage = { id: "message-user-1", createdAt: new Date("2026-07-11T12:00:00.000Z") };
const createdBotMessage = { id: "message-bot-1", createdAt: new Date("2026-07-11T12:00:01.000Z") };

function createRepository(overrides: Partial<ChatRepository> = {}): ChatRepository {
  return {
    getOrCreateSession: vi.fn().mockResolvedValue(session),
    listMessages: vi.fn().mockResolvedValue([]),
    findMessageByExternalId: vi.fn().mockResolvedValue(null),
    createMessage: vi.fn().mockResolvedValueOnce(createdUserMessage).mockResolvedValueOnce(createdBotMessage),
    touchSession: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createEmitter(): ChatEmitter {
  return { typing: vi.fn(), response: vi.fn(), checkout: vi.fn(), error: vi.fn() };
}

describe("ChatHandler", () => {
  it("snapshots accepted-turn history before later rapid messages can pollute it", async () => {
    const messages: Array<{ id: string; client_message_id: string | null; text: string; sender: "user" | "bot"; timestamp: string; status: "sent" | "seen" }> = [];
    let sequence = 0;
    const repository = createRepository({
      listMessages: vi.fn(async () => [...messages]),
      createMessage: vi.fn(async (message) => {
        sequence += 1;
        const stored = { id: `message-${sequence}`, createdAt: new Date(`2026-07-11T12:00:0${sequence}.000Z`) };
        messages.push({ id: stored.id, client_message_id: message.externalMessageId ?? null, text: message.redactedContent, sender: message.role === "USER" ? "user" : "bot", timestamp: stored.createdAt.toISOString(), status: "sent" });
        return stored;
      }),
    });
    const ai: ChatAi = { respond: vi.fn().mockResolvedValue({ text: "Done" }) };
    const handler = new ChatHandler(repository, ai);

    const [first, second] = await Promise.all([
      handler.acceptTurn({ userId: "user-1", sessionId: "session-1", text: "first", clientMessageId: "turn-1" }),
      handler.acceptTurn({ userId: "user-1", sessionId: "session-1", text: "second", clientMessageId: "turn-2" }),
    ]);
    await Promise.all([
      handler.respond({ userId: "user-1", sessionId: first.accepted.sessionId, text: "first", history: first.history }, createEmitter()),
      handler.respond({ userId: "user-1", sessionId: second.accepted.sessionId, text: "second", history: second.history }, createEmitter()),
    ]);

    expect(first.accepted.clientMessageId).toBe("turn-1");
    expect(second.accepted.clientMessageId).toBe("turn-2");
    expect(ai.respond).toHaveBeenNthCalledWith(1, expect.objectContaining({ history: [{ sender: "user", text: "first" }] }));
    expect(ai.respond).toHaveBeenNthCalledWith(2, expect.objectContaining({ history: [{ sender: "user", text: "first" }, { sender: "user", text: "second" }] }));
  });
  it("persists the response before emitting a safe checkout update", async () => {
    const repository = createRepository({ createMessage: vi.fn().mockResolvedValue(createdBotMessage) });
    const ai: ChatAi = { respond: vi.fn().mockResolvedValue({ text: "Quote ready", checkoutEvent: { state: "quote_ready", quote: { quoteId: "quote-1", subtotal: 90000, discountAmount: 0, deliveryFee: 10000, total: 100000, currency: "VND", expiresAt: "2026-07-12T12:30:00.000Z", confirmationPhrase: "CONFIRM ABCD", items: [] } } }) };
    const emitter = createEmitter();
    const handler = new ChatHandler(repository, ai);

    await handler.respond({ userId: "user-1", sessionId: "session-1", text: "checkout" }, emitter);

    expect(emitter.response).toHaveBeenCalledBefore(emitter.checkout as ReturnType<typeof vi.fn>);
    expect(emitter.checkout).toHaveBeenCalledWith(expect.objectContaining({ session_id: "session-1", checkout: expect.objectContaining({ state: "quote_ready" }) }));
    expect(JSON.stringify((emitter.checkout as ReturnType<typeof vi.fn>).mock.calls)).not.toContain("confirmationToken");
  });

  it("serializes AI responses for the same session", async () => {
    let active = 0;
    let maximumActive = 0;
    const ai: ChatAi = { respond: vi.fn().mockImplementation(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return { text: "Done" };
    }) };
    const repository = createRepository({ createMessage: vi.fn().mockResolvedValue(createdBotMessage) });
    const handler = new ChatHandler(repository, ai);

    await Promise.all([
      handler.respond({ userId: "user-1", sessionId: "session-1", text: "CONFIRM ABCD" }, createEmitter()),
      handler.respond({ userId: "user-1", sessionId: "session-1", text: "CONFIRM ABCD" }, createEmitter()),
    ]);

    expect(maximumActive).toBe(1);
  });
  it("accepts a user turn then persists and emits the AI response", async () => {
    const repository = createRepository();
    const ai: ChatAi = { respond: vi.fn().mockResolvedValue({ text: "Try our hot wings today!" }) };
    const handler = new ChatHandler(repository, ai);
    const emitter = createEmitter();

    const accepted = await handler.accept({ userId: "user-1", sessionId: "session-1", text: "What is popular?", clientMessageId: "turn-1" });
    await handler.respond({ userId: "user-1", sessionId: accepted.sessionId, text: "What is popular?" }, emitter);

    expect(accepted).toEqual({ sessionId: "session-1", messageId: "message-user-1", clientMessageId: "turn-1", acceptedAt: "2026-07-11T12:00:00.000Z" });
    expect(repository.createMessage).toHaveBeenNthCalledWith(1, { sessionId: "session-1", direction: "INBOUND", role: "USER", redactedContent: "What is popular?", externalMessageId: "turn-1" });
    expect(emitter.typing).toHaveBeenNthCalledWith(1, { session_id: "session-1", is_typing: true, stage: "thinking" });
    expect(ai.respond).toHaveBeenCalledWith({ userId: "user-1", sessionId: "session-1", text: "What is popular?", history: [] });
    expect(emitter.response).toHaveBeenCalledWith({ session_id: "session-1", message: { id: "message-bot-1", client_message_id: null, text: "Try our hot wings today!", sender: "bot", timestamp: "2026-07-11T12:00:01.000Z", status: "sent" } });
    expect(emitter.typing).toHaveBeenLastCalledWith({ session_id: "session-1", is_typing: false, stage: "thinking" });
  });

  it("does not create a duplicate message for an existing client message ID", async () => {
    const repository = createRepository({ findMessageByExternalId: vi.fn().mockResolvedValue(createdUserMessage) });
    const handler = new ChatHandler(repository, { respond: vi.fn() });

    const accepted = await handler.accept({ userId: "user-1", sessionId: "session-1", text: "duplicate", clientMessageId: "turn-1" });

    expect(accepted.messageId).toBe("message-user-1");
    expect(repository.createMessage).not.toHaveBeenCalled();
  });
});
