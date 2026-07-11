import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CHAT_PROTOCOL_VERSION,
  type AiResponseEvent,
  type AiTypingEvent,
  type ChatErrorEvent,
  type ChatMessageDto,
  type CheckoutEvent,
  type CheckoutUpdateEvent,
  type ConversationMessage,
  type TypingStage,
  type UserChatAck,
} from '../models/chat';
import { createChatSocket, type ChatSocket } from '../services/socketService';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
const typingLabels: Record<TypingStage, string> = { thinking: 'KFC Bot is thinking…', checking_menu: 'Checking today’s menu…', updating_draft: 'Updating your order…', building_quote: 'Calculating your order…', creating_order: 'Confirming your order…' };

export function useRealtimeChat(accessToken: string) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [typingStage, setTypingStage] = useState<TypingStage | null>(null);
  const [checkout, setCheckout] = useState<CheckoutEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const socketRef = useRef<ChatSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingMessagesRef = useRef(new Map<string, string>());

  const markAcknowledgement = useCallback((ack: UserChatAck) => {
    setMessages((current) => current.map((message) => {
      if (message.clientMessageId !== ack.client_message_id) return message;
      if (!ack.ok) return { ...message, errorMessage: ack.error.message, status: 'failed' };
      pendingMessagesRef.current.delete(ack.client_message_id);
      return { ...message, id: ack.message_id, errorMessage: undefined, status: 'sent' };
    }));
  }, []);

  const emitMessage = useCallback((clientMessageId: string, text: string) => {
    const socket = socketRef.current;
    const sessionId = sessionIdRef.current;
    if (!socket?.connected || !sessionId) {
      setMessages((current) => current.map((message) => message.clientMessageId === clientMessageId ? { ...message, errorMessage: 'Reconnect to send this message.', status: 'failed' } : message));
      return;
    }
    socket.emit('user_chat', { protocol_version: CHAT_PROTOCOL_VERSION, session_id: sessionId, client_message_id: clientMessageId, text, sent_at: new Date().toISOString() }, markAcknowledgement);
  }, [markAcknowledgement]);

  useEffect(() => {
    setCheckout(null);
    setMessages([]);
    setTypingStage(null);
    sessionIdRef.current = null;
    pendingMessagesRef.current.clear();
    const socket = createChatSocket(accessToken);
    socketRef.current = socket;
    const joinSession = () => {
      setConnectionStatus('connecting');
      socket.emit('session_join', { protocol_version: CHAT_PROTOCOL_VERSION, ...(sessionIdRef.current ? { session_id: sessionIdRef.current } : {}) }, (ack) => {
        if (!ack.ok) { setConnectionStatus('disconnected'); setErrorMessage(ack.error.message); return; }
        if (sessionIdRef.current !== ack.session_id) {
          setCheckout(null);
        }
        sessionIdRef.current = ack.session_id;
        setMessages((current) => mergeMessages(ack.history, current));
        setConnectionStatus('connected');
        setErrorMessage(null);
      });
    };
    const handleDisconnect = () => { setConnectionStatus('disconnected'); setTypingStage(null); };
    const handleConnectError = (error: Error) => { setConnectionStatus('disconnected'); setErrorMessage(error.message); };
    const handleAiTyping = (event: AiTypingEvent) => {
      if (event.session_id === sessionIdRef.current) setTypingStage(event.is_typing ? event.stage : null);
    };
    const handleAiResponse = (event: AiResponseEvent) => {
      if (event.session_id === sessionIdRef.current) { setTypingStage(null); setMessages((current) => mergeMessages([event.message], current)); }
    };
    const handleCheckoutUpdate = (event: CheckoutUpdateEvent) => {
      if (event.session_id === sessionIdRef.current) setCheckout(event.checkout);
    };
    const handleChatError = (event: ChatErrorEvent) => {
      if (event.session_id !== sessionIdRef.current) return;
      setErrorMessage(event.error.message);
      if (event.client_message_id) setMessages((current) => current.map((message) => message.clientMessageId === event.client_message_id ? { ...message, errorMessage: event.error.message, status: 'failed' } : message));
    };
    socket.on('connect', joinSession);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('ai_typing', handleAiTyping);
    socket.on('ai_response', handleAiResponse);
    socket.on('checkout_update', handleCheckoutUpdate);
    socket.on('chat_error', handleChatError);
    socket.connect();
    return () => {
      socket.off('connect', joinSession);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('ai_typing', handleAiTyping);
      socket.off('ai_response', handleAiResponse);
      socket.off('checkout_update', handleCheckoutUpdate);
      socket.off('chat_error', handleChatError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken]);

  const sendMessage = useCallback((text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    const clientMessageId = `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    pendingMessagesRef.current.set(clientMessageId, trimmedText);
    setMessages((current) => [{ id: clientMessageId, clientMessageId, sender: 'user', status: 'sending', text: trimmedText, timestamp: new Date().toISOString() }, ...current]);
    emitMessage(clientMessageId, trimmedText);
  }, [emitMessage]);

  const retryMessage = useCallback((clientMessageId: string) => {
    const text = pendingMessagesRef.current.get(clientMessageId);
    if (!text) return;
    setMessages((current) => current.map((message) => message.clientMessageId === clientMessageId ? { ...message, errorMessage: undefined, status: 'sending' } : message));
    emitMessage(clientMessageId, text);
  }, [emitMessage]);

  return useMemo(() => ({ checkout, connectionStatus, errorMessage, isTyping: typingStage !== null, messages, retryMessage, sendMessage, typingLabel: typingStage ? typingLabels[typingStage] : null, typingStage }), [checkout, connectionStatus, errorMessage, messages, retryMessage, sendMessage, typingStage]);
}

function mergeMessages(incoming: ChatMessageDto[], current: ConversationMessage[]) {
  const merged = new Map<string, ConversationMessage>();
  current.forEach((message) => merged.set(message.clientMessageId ?? message.id, message));
  incoming.forEach((message) => merged.set(message.client_message_id ?? message.id, { id: message.id, clientMessageId: message.client_message_id, sender: message.sender, status: message.status, text: message.text, timestamp: message.timestamp }));
  return [...merged.values()].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
}
