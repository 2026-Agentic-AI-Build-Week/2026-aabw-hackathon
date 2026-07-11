import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { theme } from '../theme';

interface CustomTextInputProps extends Omit<TextInputProps, 'style'> {
  error?: string;
  label: string;
  password?: boolean;
}

export function CustomTextInput({
  error,
  label,
  password = false,
  ...inputProps
}: CustomTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[
        styles.inputContainer,
        isFocused && styles.inputFocused,
        Boolean(error) && styles.inputError,
      ]}>
        <TextInput
          {...inputProps}
          onBlur={(event) => {
            setIsFocused(false);
            inputProps.onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            inputProps.onFocus?.(event);
          }}
          placeholderTextColor={theme.colors.loginPlaceholder}
          secureTextEntry={password && !isPasswordVisible}
          style={styles.input}
        />
        {password && (
          <Pressable
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            hitSlop={theme.spacing.sm}
            onPress={() => setIsPasswordVisible((currentValue) => !currentValue)}
            style={styles.passwordButton}
          >
            <Ionicons
              color={theme.colors.textSecondary}
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={theme.layout.iconMedium}
            />
          </Pressable>
        )}
      </View>
      {error && <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.xs,
  },
  label: {
    color: theme.colors.textPrimary,
    ...theme.typography.loginInput,
  },
  inputContainer: {
    alignItems: 'center',
    borderColor: theme.colors.loginInputBorder,
    borderRadius: theme.radius.lg,
    borderWidth: theme.spacing.xs / theme.spacing.xs,
    flexDirection: 'row',
    height: theme.layout.loginInputHeight,
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.sm,
  },
  inputFocused: {
    borderColor: theme.colors.loginBrand,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  input: {
    color: theme.colors.textPrimary,
    flex: 1,
    height: '100%',
    ...theme.typography.loginInput,
  },
  passwordButton: {
    alignItems: 'center',
    borderRadius: theme.radius.circle,
    height: theme.layout.inputBarButtonSize,
    justifyContent: 'center',
    width: theme.layout.inputBarButtonSize,
  },
  errorText: {
    color: theme.colors.error,
    ...theme.typography.messageStatus,
  },
});
