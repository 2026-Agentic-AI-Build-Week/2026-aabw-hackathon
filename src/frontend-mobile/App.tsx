import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MessengerLogin } from './pages/MessengerLogin';
import { MessengerChatModule } from './pages/MessengerChatModule';
import { theme } from './theme';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={theme.colors.surface} style="dark" />
      {isLoggedIn ? <MessengerChatModule /> : <MessengerLogin onLogin={() => setIsLoggedIn(true)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
});
