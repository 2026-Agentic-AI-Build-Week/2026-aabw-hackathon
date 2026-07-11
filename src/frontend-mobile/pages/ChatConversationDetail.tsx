import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { kfcBotProfile } from '../chatData';
import { ChatHeader } from '../components/ChatHeader';
import { CheckoutCard } from '../components/CheckoutCard';
import { ChatInputBar } from '../components/ChatInputBar';
import { MessageBubble } from '../components/MessageBubble';
import { useRealtimeChat } from '../hooks/useRealtimeChat';
import { theme } from '../theme';
import { getSystemInsets } from '../utils/systemInsets';
import type { CheckoutEvent, ConversationMessage } from '../models/chat';

type ChatTimelineItem =
  | { kind: 'checkout'; checkout: CheckoutEvent; timestamp: string }
  | { kind: 'message'; message: ConversationMessage; timestamp: string };

interface ChatConversationDetailProps {
  accessToken: string;
  onBackPress: () => void;
}

export function ChatConversationDetail({ accessToken, onBackPress }: ChatConversationDetailProps) {
  const [draft, setDraft] = useState('');
  const { checkout, connectionStatus, errorMessage, messages, retryMessage, sendMessage, typingLabel } = useRealtimeChat(accessToken);
  const systemInsets = getSystemInsets();
  const timeline = useMemo<ChatTimelineItem[]>(() => [
    ...(checkout ? [{ kind: 'checkout' as const, checkout, timestamp: checkoutTimestamp(checkout) }] : []),
    ...messages.map((message) => ({ kind: 'message' as const, message, timestamp: message.timestamp })),
  ].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()), [checkout, messages]);

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
          data={timeline}
          inverted
          keyExtractor={(item) => item.kind === 'message' ? item.message.id : checkoutKey(item.checkout)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => item.kind === 'message'
            ? <MessageBubble botAvatarUrl={kfcBotProfile.avatarUrl} message={item.message} onRetry={retryMessage} />
            : <CheckoutMessage checkout={item.checkout} onConfirmationPhrasePress={setDraft} />}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
        {(typingLabel || errorMessage || connectionStatus !== 'connected') && <View style={styles.realtimeStatus}><Text style={styles.realtimeStatusText}>{errorMessage ?? typingLabel ?? (connectionStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…')}</Text></View>}
        <ChatInputBar onChangeText={setDraft} onSend={handleSend} value={draft} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CheckoutMessage({ checkout, onConfirmationPhrasePress }: { checkout: CheckoutEvent; onConfirmationPhrasePress: (confirmationPhrase: string) => void }) {
  return (
    <View style={styles.checkoutMessageRow}>
      <Image accessibilityLabel="KFC Ordering Assistant avatar" source={{ uri: kfcBotProfile.avatarUrl }} style={styles.botAvatar} />
      <View style={styles.checkoutMessageContent}>
        <CheckoutCard checkout={checkout} embedded onConfirmationPhrasePress={onConfirmationPhrasePress} />
      </View>
    </View>
  );
}

function checkoutKey(checkout: CheckoutEvent): string {
  return checkout.state === 'quote_ready' ? `checkout-quote-${checkout.quote.quoteId}` : `checkout-order-${checkout.order.orderId}`;
}

function checkoutTimestamp(checkout: CheckoutEvent): string {
  if (checkout.state === 'order_created') return checkout.order.createdAt;
  return new Date(new Date(checkout.quote.expiresAt).getTime() - 15 * 60 * 1000).toISOString();
}

const styles = StyleSheet.create({
  botAvatar: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.circle,
    height: theme.layout.messageAvatarSize,
    marginRight: theme.spacing.sm,
    width: theme.layout.messageAvatarSize,
  },
  checkoutMessageContent: {
    flexShrink: 1,
    maxWidth: `${theme.layout.messageBubbleMaxWidth}%`,
  },
  checkoutMessageRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
  },
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
