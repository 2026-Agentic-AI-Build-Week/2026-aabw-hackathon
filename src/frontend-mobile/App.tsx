import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoginScreen } from './LoginScreen';
import { MessengerChatModule } from './pages/MessengerChatModule';
import type { AuthSession } from './services/authService';
import { theme } from './theme';

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={theme.colors.surface} style="dark" />
      {session ? <MessengerChatModule accessToken={session.accessToken} /> : <LoginScreen onLoginSuccess={setSession} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
});
