import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '../chatData';
import { theme } from '../theme';
import { AvatarWithStatus } from './AvatarWithStatus';

interface ChatListItemProps {
  chat: ChatMessage;
  onPress?: (chat: ChatMessage) => void;
}

export function ChatListItem({ chat, onPress }: ChatListItemProps) {
  const messageStyle = chat.isUnread ? styles.unreadMessage : styles.readMessage;
  const nameStyle = chat.isUnread ? styles.unreadName : styles.readName;

  return (
    <Pressable
      accessibilityLabel={`Đoạn chat với ${chat.userName}`}
      onPress={() => onPress?.(chat)}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <AvatarWithStatus avatarUrl={chat.avatarUrl} isOnline={chat.isOnline} />
      <View style={styles.content}>
        <Text numberOfLines={1} style={[styles.name, nameStyle]}>{chat.userName}</Text>
        <Text numberOfLines={1} style={[styles.message, messageStyle]}>{chat.lastMessage}</Text>
      </View>
      <View style={styles.metaContainer}>
        <Text style={[styles.time, chat.isUnread && styles.unreadTime]}>{chat.time}</Text>
        {chat.isUnread && <View accessibilityLabel="Tin nhắn chưa đọc" style={styles.unreadBadge} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingBottom: theme.layout.listItemVerticalPadding,
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.lg,
    paddingTop: theme.layout.listItemVerticalPadding,
  },
  pressed: {
    backgroundColor: theme.colors.surfaceContainer,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs / theme.spacing.xs,
    ...theme.typography.itemName,
  },
  readName: {
    fontWeight: theme.typography.itemName.fontWeight,
  },
  unreadName: {
    fontWeight: theme.typography.itemMessageUnread.fontWeight,
  },
  message: {
    color: theme.colors.textSecondary,
  },
  readMessage: {
    ...theme.typography.itemMessageRead,
  },
  unreadMessage: {
    color: theme.colors.textPrimary,
    ...theme.typography.itemMessageUnread,
  },
  metaContainer: {
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
    rowGap: theme.spacing.sm,
  },
  time: {
    color: theme.colors.textSecondary,
    ...theme.typography.meta,
  },
  unreadTime: {
    color: theme.colors.primary,
    fontWeight: theme.typography.itemMessageUnread.fontWeight,
  },
  unreadBadge: {
    backgroundColor: theme.colors.unreadBadge,
    borderRadius: theme.radius.circle,
    height: theme.layout.unreadBadgeSize,
    width: theme.layout.unreadBadgeSize,
  },
});
