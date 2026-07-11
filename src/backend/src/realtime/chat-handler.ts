import type { MessageDirection, MessageRole } from "@prisma/client";
import type { ChatAi } from "../ai/ai-client.js";
import type { AiResponseEvent, AiTypingEvent, ChatErrorEvent, ChatMessageDto } from "./chat-events.js";

type Session = { id: string; sessionKey: string };
type StoredMessage = { id: string; createdAt: Date };
type CreateMessageInput = { sessionId: string; direction: MessageDirection; role: MessageRole; redactedContent: string; externalMessageId?: string; latencyMs?: number; errorCode?: string };

export interface ChatRepository {
  getOrCreateSession(userId: string): Promise<Session>;
  listMessages(sessionId: string): Promise<ChatMessageDto[]>;
  findMessageByExternalId(sessionId: string, externalMessageId: string): Promise<StoredMessage | null>;
  createMessage(input: CreateMessageInput): Promise<StoredMessage>;
  touchSession(sessionId: string): Promise<void>;
}

export interface ChatEmitter {
  typing(payload: AiTypingEvent): void;
  response(payload: AiResponseEvent): void;
  error(payload: ChatErrorEvent): void;
}

export type AcceptedMessage = { sessionId: string; messageId: string; clientMessageId: string; acceptedAt: string };

export class ChatHandler {
  constructor(private readonly repository: ChatRepository, private readonly ai: ChatAi) {}

  async join(userId: string): Promise<{ sessionId: string; history: ChatMessageDto[] }> {
    const session = await this.repository.getOrCreateSession(userId);
    return { sessionId: session.id, history: await this.repository.listMessages(session.id) };
  }

  async accept(input: { userId: string; sessionId: string; text: string; clientMessageId: string }): Promise<AcceptedMessage> {
    const text = input.text.trim();
    if (text === "" || text.length > 4000) throw new ChatInputError("INVALID_MESSAGE", "Message text must contain 1 to 4000 characters.");
    if (input.clientMessageId.trim() === "" || input.clientMessageId.length > 255) throw new ChatInputError("INVALID_MESSAGE_ID", "client_message_id is required and must be at most 255 characters.");
    const session = await this.repository.getOrCreateSession(input.userId);
    if (input.sessionId !== session.id) throw new ChatInputError("INVALID_SESSION", "The conversation session is invalid.");
    const existing = await this.repository.findMessageByExternalId(session.id, input.clientMessageId);
    const message = existing ?? await this.repository.createMessage({ sessionId: session.id, direction: "INBOUND", role: "USER", redactedContent: text, externalMessageId: input.clientMessageId });
    return { sessionId: session.id, messageId: message.id, clientMessageId: input.clientMessageId, acceptedAt: message.createdAt.toISOString() };
  }

  async respond(input: { userId: string; sessionId: string; text: string }, emit: ChatEmitter): Promise<void> {
    emit.typing({ session_id: input.sessionId, is_typing: true, stage: "thinking" });
    const startedAt = Date.now();
    try {
      const history = await this.repository.listMessages(input.sessionId);
      const responseText = await this.ai.respond({
        userId: input.userId,
        sessionId: input.sessionId,
        text: input.text.trim(),
        history: history.map((message) => ({ sender: message.sender, text: message.text })),
      });
      const message = await this.repository.createMessage({ sessionId: input.sessionId, direction: "OUTBOUND", role: "ASSISTANT", redactedContent: responseText, latencyMs: Date.now() - startedAt });
      await this.repository.touchSession(input.sessionId);
      emit.response({ session_id: input.sessionId, message: { id: message.id, client_message_id: null, text: responseText, sender: "bot", timestamp: message.createdAt.toISOString(), status: "sent" } });
    } finally {
      emit.typing({ session_id: input.sessionId, is_typing: false, stage: "thinking" });
    }
  }
}

export class ChatInputError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
