export const CHAT_PROTOCOL_VERSION = 1 as const;
export type ChatSender = 'user' | 'bot';
export type ChatMessageStatus = 'sending' | 'sent' | 'seen' | 'failed';
export type TypingStage = 'thinking' | 'checking_menu' | 'updating_draft' | 'building_quote' | 'creating_order';

export interface ChatMessageDto { id: string; client_message_id: string | null; text: string; sender: ChatSender; timestamp: string; status: ChatMessageStatus; }
export interface ChatErrorDto { code: string; message: string; retryable: boolean; }
export interface SessionJoinPayload { protocol_version: typeof CHAT_PROTOCOL_VERSION; session_id?: string; }
export type SessionJoinAck = { ok: true; session_id: string; history: ChatMessageDto[] } | { ok: false; error: ChatErrorDto };
export interface UserChatPayload { protocol_version: typeof CHAT_PROTOCOL_VERSION; session_id: string; client_message_id: string; text: string; sent_at: string; }
export type UserChatAck = { ok: true; session_id: string; message_id: string; client_message_id: string; accepted_at: string } | { ok: false; client_message_id: string; error: ChatErrorDto };
export interface AiTypingEvent { session_id: string; is_typing: boolean; stage: TypingStage; }
export interface AiResponseEvent { session_id: string; message: ChatMessageDto; }
export interface ChatErrorEvent { session_id: string; client_message_id: string | null; error: ChatErrorDto; }
export interface ServerToClientEvents { ai_typing: (payload: AiTypingEvent) => void; ai_response: (payload: AiResponseEvent) => void; chat_error: (payload: ChatErrorEvent) => void; }
export interface ClientToServerEvents { session_join: (payload: SessionJoinPayload, acknowledge: (result: SessionJoinAck) => void) => void; user_chat: (payload: UserChatPayload, acknowledge: (result: UserChatAck) => void) => void; }
export interface ConversationMessage { id: string; clientMessageId: string | null; text: string; sender: ChatSender; timestamp: string; status: ChatMessageStatus; errorMessage?: string; }
