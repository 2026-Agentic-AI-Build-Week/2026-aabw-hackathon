import { Image, StyleSheet, View } from 'react-native';

import { theme } from '../theme';

interface AvatarWithStatusProps {
  avatarUrl: string;
  isOnline: boolean;
}

export function AvatarWithStatus({
  avatarUrl,
  isOnline,
}: AvatarWithStatusProps) {
  return (
    <View style={styles.container}>
      <Image accessibilityLabel="Ảnh đại diện" source={{ uri: avatarUrl }} style={styles.avatar} />
      <View
        accessibilityLabel={isOnline ? 'Đang hoạt động' : 'Không hoạt động'}
        style={[styles.statusDot, isOnline ? styles.online : styles.offline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: theme.layout.avatarSize,
    position: 'relative',
    width: theme.layout.avatarSize,
  },
  avatar: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radius.circle,
    height: theme.layout.avatarSize,
    width: theme.layout.avatarSize,
  },
  statusDot: {
    borderColor: theme.colors.surface,
    borderRadius: theme.radius.circle,
    borderWidth: theme.spacing.xs / theme.spacing.xs,
    bottom: theme.spacing.xs / theme.spacing.xs,
    height: theme.layout.statusDotSize,
    position: 'absolute',
    right: theme.spacing.xs / theme.spacing.xs,
    width: theme.layout.statusDotSize,
  },
  online: {
    backgroundColor: theme.colors.statusOnline,
  },
  offline: {
    backgroundColor: theme.colors.statusOffline,
  },
});
