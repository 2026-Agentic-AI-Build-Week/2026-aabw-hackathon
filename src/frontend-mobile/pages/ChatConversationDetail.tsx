import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
} from 'react-native';

import {
  conversationMessages,
  kfcBotProfile,
  type MessageDetail,
} from '../chatData';
import { ChatHeader } from '../components/ChatHeader';
import { ChatInputBar } from '../components/ChatInputBar';
import { MessageBubble } from '../components/MessageBubble';
import { theme } from '../theme';
import { getSystemInsets } from '../utils/systemInsets';

interface ChatConversationDetailProps {
  onBackPress: () => void;
}

export function ChatConversationDetail({ onBackPress }: ChatConversationDetailProps) {
  const [messages, setMessages] = useState<MessageDetail[]>(conversationMessages);
  const [draft, setDraft] = useState('');

  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const systemInsets = getSystemInsets();

  const handleSend = () => {
    const trimmedDraft = draft.trim();

    if (!trimmedDraft) {
      return;
    }

    const message: MessageDetail = {
      id: `message-${Date.now()}`,
      sender: 'user',
      status: 'sent',
      text: trimmedDraft,
      timestamp: 'Now',
    };

    setMessages((currentMessages) => [...currentMessages, message]);
    setDraft('');
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          paddingBottom: systemInsets.bottom,
          paddingTop: systemInsets.top,
        },
      ]}
    >
      <KeyboardAvoidingView behavior={Platform.select({ android: 'height', ios: 'padding' })} style={styles.keyboardAvoidingView}>
        <ChatHeader
          avatarUrl={kfcBotProfile.avatarUrl}
          name={kfcBotProfile.name}
          onBackPress={onBackPress}
          status={kfcBotProfile.status}
        />
        <FlatList
          contentContainerStyle={styles.listContent}
          data={invertedMessages}
          inverted
          keyExtractor={(message) => message.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <MessageBubble botAvatarUrl={kfcBotProfile.avatarUrl} message={item} />}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
        <ChatInputBar onChangeText={setDraft} onSend={handleSend} value={draft} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.chatCanvas,
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  list: {
    backgroundColor: theme.colors.chatCanvas,
    flex: 1,
  },
  listContent: {
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
});
