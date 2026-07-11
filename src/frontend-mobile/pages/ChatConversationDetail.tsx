import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { kfcBotProfile } from '../chatData';
import { ChatHeader } from '../components/ChatHeader';
import { ChatInputBar } from '../components/ChatInputBar';
import { MessageBubble } from '../components/MessageBubble';
import { useRealtimeChat } from '../hooks/useRealtimeChat';
import { theme } from '../theme';
import { getSystemInsets } from '../utils/systemInsets';

interface ChatConversationDetailProps {
  accessToken: string;
  onBackPress: () => void;
}

export function ChatConversationDetail({ accessToken, onBackPress }: ChatConversationDetailProps) {
  const [draft, setDraft] = useState('');
  const { connectionStatus, errorMessage, messages, retryMessage, sendMessage, typingLabel } = useRealtimeChat(accessToken);
  const systemInsets = getSystemInsets();

  const handleSend = () => {
    const trimmedDraft = draft.trim();

    if (!trimmedDraft) {
      return;
    }

    sendMessage(trimmedDraft);
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
          data={messages}
          inverted
          keyExtractor={(message) => message.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <MessageBubble botAvatarUrl={kfcBotProfile.avatarUrl} message={item} onRetry={retryMessage} />}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
        {(typingLabel || errorMessage || connectionStatus !== 'connected') && <View style={styles.realtimeStatus}><Text style={styles.realtimeStatusText}>{errorMessage ?? typingLabel ?? (connectionStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…')}</Text></View>}
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
  realtimeStatus: {
    backgroundColor: theme.colors.chatCanvas,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  realtimeStatusText: {
    color: theme.colors.textSecondary,
    ...theme.typography.messageStatus,
  },
});
