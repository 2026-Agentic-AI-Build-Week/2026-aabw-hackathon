import type { MessageDirection, MessageRole } from "@prisma/client";
import type { ChatAi } from "../ai/ai-client.js";
import type { CheckoutEvent } from "../ai/checkout-types.js";
import type { AiResponseEvent, AiTypingEvent, ChatErrorEvent, ChatMessageDto, CheckoutUpdateEvent } from "./chat-events.js";

type Session = { id: string; sessionKey: string };
type StoredMessage = { id: string; createdAt: Date };
type CreateMessageInput = { sessionId: string; direction: MessageDirection; role: MessageRole; redactedContent: string; externalMessageId?: string; latencyMs?: number; errorCode?: string };

export interface ChatRepository {
  getOrCreateSession(userId: string): Promise<Session>;
  getCheckout(sessionId: string): Promise<CheckoutEvent | null>;
  listMessages(sessionId: string): Promise<ChatMessageDto[]>;
  findMessageByExternalId(sessionId: string, externalMessageId: string): Promise<StoredMessage | null>;
  createMessage(input: CreateMessageInput): Promise<StoredMessage>;
  touchSession(sessionId: string): Promise<void>;
}

export interface ChatEmitter {
  typing(payload: AiTypingEvent): void;
  response(payload: AiResponseEvent): void;
  checkout(payload: CheckoutUpdateEvent): void;
  error(payload: ChatErrorEvent): void;
}

export type AcceptedMessage = { sessionId: string; messageId: string; clientMessageId: string; acceptedAt: string };
export type AcceptedTurn = { accepted: AcceptedMessage; history: Array<{ sender: "user" | "bot"; text: string }> };

export class ChatHandler {
  private readonly responseQueues = new Map<string, Promise<void>>();
  private readonly acceptanceQueues = new Map<string, Promise<AcceptedTurn>>();
  constructor(private readonly repository: ChatRepository, private readonly ai: ChatAi) {}

  async join(userId: string): Promise<{ sessionId: string; history: ChatMessageDto[]; checkout: CheckoutEvent | null }> {
    const session = await this.repository.getOrCreateSession(userId);
    const [history, checkout] = await Promise.all([this.repository.listMessages(session.id), this.repository.getCheckout(session.id)]);
    return { sessionId: session.id, history, checkout };
  }

  async accept(input: ChatTurnInput): Promise<AcceptedMessage> {
    return (await this.acceptTurn(input)).accepted;
  }

  acceptTurn(input: ChatTurnInput): Promise<AcceptedTurn> {
    const previous = this.acceptanceQueues.get(input.sessionId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(() => this.acceptOnce(input));
    this.acceptanceQueues.set(input.sessionId, current);
    return current.finally(() => {
      if (this.acceptanceQueues.get(input.sessionId) === current) this.acceptanceQueues.delete(input.sessionId);
    });
  }

  private async acceptOnce(input: ChatTurnInput): Promise<AcceptedTurn> {
    const text = input.text.trim();
    if (text === "" || text.length > 4000) throw new ChatInputError("INVALID_MESSAGE", "Message text must contain 1 to 4000 characters.");
    if (input.clientMessageId.trim() === "" || input.clientMessageId.length > 255) throw new ChatInputError("INVALID_MESSAGE_ID", "client_message_id is required and must be at most 255 characters.");
    const session = await this.repository.getOrCreateSession(input.userId);
    if (input.sessionId !== session.id) throw new ChatInputError("INVALID_SESSION", "The conversation session is invalid.");
    const existing = await this.repository.findMessageByExternalId(session.id, input.clientMessageId);
    const message = existing ?? await this.repository.createMessage({ sessionId: session.id, direction: "INBOUND", role: "USER", redactedContent: text, externalMessageId: input.clientMessageId });
    const history = await this.repository.listMessages(session.id);
    return {
      accepted: { sessionId: session.id, messageId: message.id, clientMessageId: input.clientMessageId, acceptedAt: message.createdAt.toISOString() },
      history: history.map((entry) => ({ sender: entry.sender, text: entry.text })),
    };
  }

  respond(input: ChatResponseInput, emit: ChatEmitter): Promise<void> {
    const previous = this.responseQueues.get(input.sessionId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(() => this.respondOnce(input, emit));
    this.responseQueues.set(input.sessionId, current);
    return current.finally(() => {
      if (this.responseQueues.get(input.sessionId) === current) this.responseQueues.delete(input.sessionId);
    });
  }

  private async respondOnce(input: ChatResponseInput, emit: ChatEmitter): Promise<void> {
    emit.typing({ session_id: input.sessionId, is_typing: true, stage: "thinking" });
    const startedAt = Date.now();
    try {
      const history = input.history ?? (await this.repository.listMessages(input.sessionId)).map((message) => ({ sender: message.sender, text: message.text }));
      const result = await this.ai.respond({
        userId: input.userId,
        sessionId: input.sessionId,
        text: input.text.trim(),
        history,
      });
      const message = await this.repository.createMessage({ sessionId: input.sessionId, direction: "OUTBOUND", role: "ASSISTANT", redactedContent: result.text, latencyMs: Date.now() - startedAt });
      await this.repository.touchSession(input.sessionId);
      emit.response({ session_id: input.sessionId, message: { id: message.id, client_message_id: null, text: result.text, sender: "bot", timestamp: message.createdAt.toISOString(), status: "sent" } });
      if (result.checkoutEvent) emit.checkout({ session_id: input.sessionId, checkout: result.checkoutEvent });
    } finally {
      emit.typing({ session_id: input.sessionId, is_typing: false, stage: "thinking" });
    }
  }
}

type ChatTurnInput = { userId: string; sessionId: string; text: string; clientMessageId: string };
type ChatResponseInput = { userId: string; sessionId: string; text: string; history?: Array<{ sender: "user" | "bot"; text: string }> };

export class ChatInputError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
