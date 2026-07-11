import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View } from 'react-native';

import { theme } from '../theme';

interface SearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
}

export function SearchBar({ value, onChangeText }: SearchBarProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <Ionicons color={theme.colors.metaAi} name="sparkles" size={theme.layout.iconMedium} />
        <TextInput
          accessibilityLabel="Tìm kiếm đoạn chat"
          autoCapitalize="none"
          onChangeText={onChangeText}
          placeholder="Hỏi Meta AI hoặc tìm kiếm"
          placeholderTextColor={theme.colors.textSecondary}
          returnKeyType="search"
          style={styles.input}
          value={value}
        />
        <Ionicons color={theme.colors.textSecondary} name="grid-outline" size={theme.layout.iconMedium} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: theme.colors.surface,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceContainer,
    borderRadius: theme.radius.circle,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    height: theme.layout.searchBarHeight,
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    color: theme.colors.textPrimary,
    flex: 1,
    ...theme.typography.searchInput,
  },
});
