import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../models/chat';

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createChatSocket(accessToken: string): ChatSocket {
  const socketOptions: NonNullable<Parameters<typeof io>[1]> = {
    auth: { accessToken },
    autoConnect: false,
    reconnection: true,
    transports: ['websocket'],
  };

  return io(getSocketUrl(), socketOptions);
}

function getSocketUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_SOCKET_URL?.trim() || process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!configuredUrl) throw new Error('Set EXPO_PUBLIC_SOCKET_URL or EXPO_PUBLIC_API_BASE_URL to use realtime chat.');
  return configuredUrl.replace(/\/+$/, '');
}
