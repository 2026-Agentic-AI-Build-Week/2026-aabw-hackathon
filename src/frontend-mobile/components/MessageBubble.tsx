import { Image, StyleSheet, Text, View } from 'react-native';

import type { MessageDetail } from '../chatData';
import { theme } from '../theme';

interface MessageBubbleProps {
  botAvatarUrl: string;
  message: MessageDetail;
}

export function MessageBubble({ botAvatarUrl, message }: MessageBubbleProps) {
  const isUser = message.sender === 'user';

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.botRow]}>
      {!isUser && <Image accessibilityLabel="KFC Ordering Assistant avatar" source={{ uri: botAvatarUrl }} style={styles.botAvatar} />}
      <View style={[styles.messageColumn, isUser ? styles.userColumn : styles.botColumn]}>
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.botText]}>{message.text}</Text>
        </View>
        <Text style={[styles.meta, isUser ? styles.userMeta : styles.botMeta]}>{formatStatus(message)}</Text>
      </View>
    </View>
  );
}

function formatStatus(message: MessageDetail) {
  if (message.sender === 'bot') {
    return message.timestamp;
  }

  return `${message.timestamp} · ${message.status}`;
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
});
