import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ConversationMessage } from '../models/chat';
import { theme } from '../theme';

interface MessageBubbleProps {
  botAvatarUrl: string;
  message: ConversationMessage;
  onRetry: (clientMessageId: string) => void;
}

export function MessageBubble({ botAvatarUrl, message, onRetry }: MessageBubbleProps) {
  const isUser = message.sender === 'user';

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.botRow]}>
      {!isUser && <Image accessibilityLabel="KFC Ordering Assistant avatar" source={{ uri: botAvatarUrl }} style={styles.botAvatar} />}
      <View style={[styles.messageColumn, isUser ? styles.userColumn : styles.botColumn]}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.botText]}>{message.text}</Text>
        </View>
        <Text style={[styles.meta, isUser ? styles.userMeta : styles.botMeta]}>{formatStatus(message)}</Text>
        {message.status === 'failed' && message.clientMessageId && <Pressable onPress={() => onRetry(message.clientMessageId!)}><Text style={styles.retryText}>Tap to retry</Text></Pressable>}
      </View>
    </View>
  );
}

function formatStatus(message: ConversationMessage) {
  const parsed = new Date(message.timestamp);
  const timestamp = Number.isNaN(parsed.getTime()) ? message.timestamp : parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (message.sender === 'bot') {
    return timestamp;
  }

  return `${timestamp} · ${message.status}`;
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    marginVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
  },
  botRow: {
    justifyContent: 'flex-start',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  botAvatar: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.circle,
    height: theme.layout.messageAvatarSize,
    marginRight: theme.spacing.sm,
    width: theme.layout.messageAvatarSize,
  },
  messageColumn: {
    maxWidth: `${theme.layout.messageBubbleMaxWidth}%`,
  },
  botColumn: {
    alignItems: 'flex-start',
  },
  userColumn: {
    alignItems: 'flex-end',
  },
  bubble: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  botBubble: {
    backgroundColor: theme.colors.chatBotBubble,
    borderBottomLeftRadius: theme.radius.sm,
    borderBottomRightRadius: theme.radius.lg + theme.radius.lg,
    borderTopLeftRadius: theme.radius.lg + theme.radius.lg,
    borderTopRightRadius: theme.radius.lg + theme.radius.lg,
  },
  userBubble: {
    backgroundColor: theme.colors.chatUserBubble,
    borderBottomLeftRadius: theme.radius.lg + theme.radius.lg,
    borderBottomRightRadius: theme.radius.lg + theme.radius.lg,
    borderTopLeftRadius: theme.radius.lg + theme.radius.lg,
    borderTopRightRadius: theme.radius.lg + theme.radius.lg,
  },
  messageText: {
    ...theme.typography.messageText,
  },
  botText: {
    color: theme.colors.textPrimary,
  },
  userText: {
    color: theme.colors.chatUserText,
  },
  meta: {
    marginTop: theme.spacing.xs,
    ...theme.typography.messageStatus,
  },
  botMeta: {
    color: theme.colors.textSecondary,
  },
  userMeta: {
    color: theme.colors.textSecondary,
  },
  retryText: { color: theme.colors.error, marginTop: theme.spacing.xs, ...theme.typography.messageStatus },
});
