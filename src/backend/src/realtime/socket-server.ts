import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { AuthService } from "../auth/auth-service.js";
import { ChatHandler, ChatInputError, type ChatEmitter } from "./chat-handler.js";
import { CHAT_PROTOCOL_VERSION, type ClientToServerEvents, type ServerToClientEvents, type SocketData } from "./chat-events.js";

type SocketChatEmitterTarget = {
  emit<Event extends keyof ServerToClientEvents>(event: Event, payload: Parameters<ServerToClientEvents[Event]>[0]): unknown;
};

export function createSocketChatEmitter(socket: SocketChatEmitterTarget): ChatEmitter {
  return {
    typing: (payload) => { socket.emit("ai_typing", payload); },
    response: (payload) => { socket.emit("ai_response", payload); },
    checkout: (payload) => { socket.emit("checkout_update", payload); },
    error: (payload) => { socket.emit("chat_error", payload); },
  };
}

export function attachChatSocketServer(httpServer: HttpServer, auth: AuthService, handler: ChatHandler): Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, { cors: { origin: "*" } });
  io.use((socket, next) => {
    const token = socket.handshake.auth.accessToken;
    if (typeof token !== "string" || token.trim() === "") return next(new Error("Authentication is required."));
    try {
      const principal = auth.authenticateAccessToken(token);
      socket.data.userId = principal.userId;
      socket.data.deviceId = principal.deviceId;
      next();
    } catch {
      next(new Error("Authentication is invalid."));
    }
  });
  io.on("connection", (socket) => {
    const emitter = createSocketChatEmitter(socket);
    socket.on("session_join", (payload, acknowledge) => void (async () => {
      try {
        if (payload.protocol_version !== CHAT_PROTOCOL_VERSION) throw new ChatInputError("UNSUPPORTED_PROTOCOL", "The chat protocol version is unsupported.");
        const session = await handler.join(socket.data.userId);
        acknowledge({ ok: true, session_id: session.sessionId, history: session.history });
      } catch (error) {
        acknowledge({ ok: false, error: toErrorDto(error) });
      }
    })());
    socket.on("user_chat", (payload, acknowledge) => void (async () => {
      try {
        if (payload.protocol_version !== CHAT_PROTOCOL_VERSION) throw new ChatInputError("UNSUPPORTED_PROTOCOL", "The chat protocol version is unsupported.");
        const turn = await handler.acceptTurn({ userId: socket.data.userId, sessionId: payload.session_id, text: payload.text, clientMessageId: payload.client_message_id });
        const accepted = turn.accepted;
        acknowledge({ ok: true, session_id: accepted.sessionId, message_id: accepted.messageId, client_message_id: accepted.clientMessageId, accepted_at: accepted.acceptedAt });
        void handler.respond({ userId: socket.data.userId, sessionId: accepted.sessionId, text: payload.text, history: turn.history }, emitter).catch((error) => {
          console.error("Realtime AI response failed", error);
          emitter.error({ session_id: accepted.sessionId, client_message_id: accepted.clientMessageId, error: toErrorDto(error) });
        });
      } catch (error) {
        acknowledge({ ok: false, client_message_id: payload.client_message_id, error: toErrorDto(error) });
      }
    })());
  });
  return io;
}

function toErrorDto(error: unknown) {
  if (error instanceof ChatInputError) return { code: error.code, message: error.message, retryable: false };
  return { code: "CHAT_FAILED", message: "The chat service could not process this message.", retryable: true };
}
