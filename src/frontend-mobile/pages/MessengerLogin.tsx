import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { theme } from '../theme';

interface MessengerLoginProps {
  onLogin: (identifier: string) => void;
}

export function MessengerLogin({ onLogin }: MessengerLoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const canSubmit = identifier.trim().length > 0 && password.length > 0;
  const androidStatusBarInset = Platform.OS === 'android'
    ? StatusBar.currentHeight ?? theme.spacing.xl
    : undefined;

  const handleSubmit = () => {
    if (canSubmit) {
      onLogin(identifier.trim());
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: androidStatusBarInset }]}>
      <KeyboardAvoidingView behavior={Platform.select({ android: 'height', ios: 'padding' })} style={styles.keyboardAvoidingView}>
        <View style={styles.content}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.logo}>
            <Ionicons color={theme.colors.chatUserText} name="chatbubble-ellipses" size={theme.layout.loginLogoIconSize} />
          </View>
          <View style={styles.form}>
            <TextInput
              accessibilityLabel="Số di động hoặc email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setIdentifier}
              placeholder="Số di động hoặc email"
              placeholderTextColor={theme.colors.loginPlaceholder}
              style={styles.input}
              textContentType="username"
              value={identifier}
            />
            <TextInput
              accessibilityLabel="Mật khẩu"
              autoCapitalize="none"
              autoComplete="password"
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
              placeholder="Mật khẩu"
              placeholderTextColor={theme.colors.loginPlaceholder}
              secureTextEntry
              style={styles.input}
              textContentType="password"
              value={password}
            />
            <Pressable
              accessibilityLabel="Đăng nhập"
              disabled={!canSubmit}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.loginButton,
                !canSubmit && styles.loginButtonDisabled,
                pressed && canSubmit && styles.loginButtonPressed,
              ]}
            >
              <Text style={styles.loginButtonText}>Đăng nhập</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: theme.layout.loginContentOffset,
    paddingHorizontal: theme.spacing.xl + theme.spacing.xs,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: theme.colors.loginBrand,
    borderRadius: theme.radius.circle,
    height: theme.layout.loginLogoSize,
    justifyContent: 'center',
    marginBottom: theme.spacing.xl + theme.spacing.xl,
    width: theme.layout.loginLogoSize,
  },
  form: {
    gap: theme.spacing.md,
    width: '100%',
  },
  input: {
    borderColor: theme.colors.loginInputBorder,
    borderRadius: theme.radius.lg,
    borderWidth: theme.spacing.xs / theme.spacing.xs,
    color: theme.colors.textPrimary,
    height: theme.layout.loginInputHeight,
    paddingHorizontal: theme.spacing.lg,
    ...theme.typography.loginInput,
  },
  loginButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.loginBrand,
    borderRadius: theme.radius.circle,
    height: theme.layout.loginInputHeight,
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
  },
  loginButtonDisabled: {
    backgroundColor: theme.colors.loginButtonDisabled,
  },
  loginButtonPressed: {
    opacity: theme.spacing.xl / (theme.spacing.xl + theme.spacing.xs),
  },
  loginButtonText: {
    color: theme.colors.chatUserText,
    ...theme.typography.loginButton,
  },
});
