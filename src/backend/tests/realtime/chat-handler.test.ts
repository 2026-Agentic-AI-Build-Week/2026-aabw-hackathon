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
  return { typing: vi.fn(), response: vi.fn(), error: vi.fn() };
}

describe("ChatHandler", () => {
  it("accepts a user turn then persists and emits the AI response", async () => {
    const repository = createRepository();
    const ai: ChatAi = { respond: vi.fn().mockResolvedValue("Try our hot wings today!") };
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
