import { useState } from 'react';

import { KFC_ORDERING_BOT_ID, type ChatMessage } from '../chatData';
import { ChatConversationDetail } from './ChatConversationDetail';
import { MessengerChatList } from './MessengerChatList';

interface MessengerChatModuleProps {
  accessToken: string;
}

export function MessengerChatModule({ accessToken }: MessengerChatModuleProps) {
  const [selectedChat, setSelectedChat] = useState<ChatMessage | null>(null);

  if (selectedChat) {
    return <ChatConversationDetail accessToken={accessToken} onBackPress={() => setSelectedChat(null)} />;
  }

  return <MessengerChatList onChatPress={(chat) => {
    if (chat.id === KFC_ORDERING_BOT_ID) {
      setSelectedChat(chat);
    }
  }} />;
}
