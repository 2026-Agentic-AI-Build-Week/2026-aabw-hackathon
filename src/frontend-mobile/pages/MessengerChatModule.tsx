import { useState } from 'react';

import type { ChatMessage } from '../chatData';
import { ChatConversationDetail } from './ChatConversationDetail';
import { MessengerChatList } from './MessengerChatList';

export function MessengerChatModule() {
  const [selectedChat, setSelectedChat] = useState<ChatMessage | null>(null);

  if (selectedChat) {
    return <ChatConversationDetail onBackPress={() => setSelectedChat(null)} />;
  }

  return <MessengerChatList onChatPress={setSelectedChat} />;
}
