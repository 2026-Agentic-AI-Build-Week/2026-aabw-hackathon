import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { theme } from '../theme';

interface ChatInputBarProps {
  disabled?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
}

export function ChatInputBar({ disabled = false, value, onChangeText, onSend }: ChatInputBarProps) {
  const hasText = value.trim().length > 0;

  return (
    <View style={styles.container}>
      <Pressable accessibilityLabel="Attach image" hitSlop={theme.spacing.xs} style={styles.iconButton}>
        <Ionicons color={theme.colors.primary} name="image" size={theme.layout.iconMedium} />
      </Pressable>
      <Pressable accessibilityLabel="Record voice message" hitSlop={theme.spacing.xs} style={styles.iconButton}>
        <Ionicons color={theme.colors.primary} name="mic" size={theme.layout.iconMedium} />
      </Pressable>
      <View style={styles.inputContainer}>
        <TextInput
          accessibilityLabel="Message"
          editable={!disabled}
          multiline
          onChangeText={onChangeText}
          placeholder="Message"
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.input}
          value={value}
        />
      </View>
      <Pressable
        accessibilityLabel={hasText ? 'Send message' : 'Send like'}
        disabled={disabled || !hasText}
        hitSlop={theme.spacing.xs}
        onPress={hasText && !disabled ? onSend : undefined}
        style={[styles.sendButton, disabled && styles.sendButtonDisabled]}
      >
        <Ionicons color={theme.colors.sendButton} name={hasText ? 'send' : 'thumbs-up'} size={theme.layout.iconMedium} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.surfaceContainer,
    borderTopWidth: theme.spacing.xs / theme.spacing.xs,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: theme.radius.circle,
    height: theme.layout.inputBarButtonSize,
    justifyContent: 'center',
    width: theme.layout.inputBarButtonSize,
  },
  inputContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.chatBotBubble,
    borderRadius: theme.radius.circle,
    flex: 1,
    minHeight: theme.layout.inputBarHeight,
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    color: theme.colors.textPrimary,
    flex: 1,
    maxHeight: theme.layout.avatarSize,
    paddingBottom: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    width: '100%',
    ...theme.typography.messageText,
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: theme.radius.circle,
    height: theme.layout.inputBarButtonSize,
    justifyContent: 'center',
    width: theme.layout.inputBarButtonSize,
  },
  sendButtonDisabled: { opacity: theme.opacity.disabled },
});
