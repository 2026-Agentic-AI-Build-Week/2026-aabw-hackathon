import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

interface ChatHeaderProps {
  avatarUrl: string;
  name: string;
  status: string;
  onBackPress: () => void;
  onCallPress?: () => void;
  onVideoPress?: () => void;
}

export function ChatHeader({
  avatarUrl,
  name,
  status,
  onBackPress,
  onCallPress,
  onVideoPress,
}: ChatHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.leading}>
        <Pressable accessibilityLabel="Go back" hitSlop={theme.spacing.sm} onPress={onBackPress} style={styles.backButton}>
          <Ionicons color={theme.colors.primary} name="arrow-back" size={theme.layout.iconLarge} />
        </Pressable>
        <View style={styles.identity}>
          <Image accessibilityLabel={`${name} avatar`} source={{ uri: avatarUrl }} style={styles.avatar} />
          <View style={styles.textContainer}>
            <Text numberOfLines={1} style={styles.name}>{name}</Text>
            <Text numberOfLines={1} style={styles.status}>{status}</Text>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityLabel="Start voice call" hitSlop={theme.spacing.sm} onPress={onCallPress} style={styles.actionButton}>
          <Ionicons color={theme.colors.primary} name="call" size={theme.layout.iconLarge} />
        </Pressable>
        <Pressable accessibilityLabel="Start video call" hitSlop={theme.spacing.sm} onPress={onVideoPress} style={styles.actionButton}>
          <Ionicons color={theme.colors.primary} name="videocam" size={theme.layout.iconLarge} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderBottomColor: theme.colors.surfaceContainer,
    borderBottomWidth: theme.spacing.xs / theme.spacing.xs,
    flexDirection: 'row',
    height: theme.layout.conversationHeaderHeight,
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
  },
  leading: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: theme.radius.circle,
    height: theme.layout.conversationAvatarSize,
    justifyContent: 'center',
    marginRight: theme.spacing.xs,
    width: theme.layout.conversationAvatarSize,
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.md,
    minWidth: 0,
  },
  avatar: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.circle,
    height: theme.layout.conversationAvatarSize,
    width: theme.layout.conversationAvatarSize,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: theme.colors.textPrimary,
    ...theme.typography.conversationName,
  },
  status: {
    color: theme.colors.textSecondary,
    ...theme.typography.messageStatus,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: theme.radius.circle,
    height: theme.layout.inputBarButtonSize,
    justifyContent: 'center',
    width: theme.layout.inputBarButtonSize,
  },
});
