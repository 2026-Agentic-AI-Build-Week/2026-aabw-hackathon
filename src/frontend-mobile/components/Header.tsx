import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

interface HeaderProps {
  onCameraPress?: () => void;
  onComposePress?: () => void;
}

export function Header({ onCameraPress, onComposePress }: HeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đoạn chat</Text>
      <View style={styles.actions}>
        <Pressable accessibilityLabel="Mở camera" hitSlop={theme.spacing.sm} onPress={onCameraPress} style={styles.actionButton}>
          <Ionicons color={theme.colors.textPrimary} name="camera-outline" size={theme.layout.iconLarge} />
        </Pressable>
        <Pressable accessibilityLabel="Soạn tin nhắn mới" hitSlop={theme.spacing.sm} onPress={onComposePress} style={styles.actionButton}>
          <Ionicons color={theme.colors.textPrimary} name="create-outline" size={theme.layout.iconLarge} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    height: theme.layout.headerHeight,
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
  },
  title: {
    color: theme.colors.primary,
    ...theme.typography.title,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: theme.radius.circle,
    height: theme.layout.headerActionSize,
    justifyContent: 'center',
    width: theme.layout.headerActionSize,
  },
});
