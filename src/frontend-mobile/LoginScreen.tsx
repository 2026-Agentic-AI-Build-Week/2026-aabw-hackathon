import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CustomTextInput } from './components/CustomTextInput';
import { AuthServiceError, type AuthSession, loginService } from './services/authService';
import { theme } from './theme';
import { getSystemInsets } from './utils/systemInsets';

interface LoginScreenProps {
  onLoginSuccess: (session: AuthSession) => void;
}

interface LoginFormErrors {
  email?: string;
  password?: string;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const systemInsets = getSystemInsets();

  const handleSubmit = async () => {
    const validationErrors = validateForm(email, password);
    setErrors(validationErrors);
    setServerError(null);

    if (Object.keys(validationErrors).length > 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await loginService(email.trim(), password);
      onLoginSuccess(session);
    } catch (error) {
      setServerError(
        error instanceof AuthServiceError
          ? error.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: systemInsets.top }]}>
      <KeyboardAvoidingView behavior={Platform.select({ android: 'height', ios: 'padding' })} style={styles.keyboardAvoidingView}>
        <View style={styles.content}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.logo}>
            <Ionicons color={theme.colors.chatUserText} name="chatbubble-ellipses" size={theme.layout.loginLogoIconSize} />
          </View>
          <View style={styles.form}>
            <CustomTextInput
              accessibilityLabel="Email"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
              keyboardType="email-address"
              label="Email"
              onChangeText={(value) => {
                setEmail(value);
                setErrors((currentErrors) => ({ ...currentErrors, email: undefined }));
              }}
              placeholder="Email"
              textContentType="emailAddress"
              value={email}
            />
            <CustomTextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoComplete="password"
              error={errors.password}
              label="Password"
              onChangeText={(value) => {
                setPassword(value);
                setErrors((currentErrors) => ({ ...currentErrors, password: undefined }));
              }}
              onSubmitEditing={handleSubmit}
              password
              placeholder="Password"
              textContentType="password"
              value={password}
            />
            {serverError && <Text accessibilityLiveRegion="polite" style={styles.serverError}>{serverError}</Text>}
            <Pressable
              accessibilityLabel="Login"
              disabled={isSubmitting}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.loginButton,
                isSubmitting && styles.loginButtonDisabled,
                pressed && !isSubmitting && styles.loginButtonPressed,
              ]}
            >
              {isSubmitting
                ? <ActivityIndicator color={theme.colors.chatUserText} size="small" />
                : <Text style={styles.loginButtonText}>Login</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function validateForm(email: string, password: string): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  }

  return errors;
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
  serverError: {
    color: theme.colors.error,
    ...theme.typography.messageStatus,
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
