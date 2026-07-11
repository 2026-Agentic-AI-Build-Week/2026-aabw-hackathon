import { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';

import { chatData, type ChatMessage } from '../chatData';
import { ChatListItem } from '../components/ChatListItem';
import { Header } from '../components/Header';
import { SearchBar } from '../components/SearchBar';
import { theme } from '../theme';

interface MessengerChatListProps {
  onChatPress?: (chat: ChatMessage) => void;
}

export function MessengerChatList({ onChatPress }: MessengerChatListProps) {
  const [query, setQuery] = useState('');
  const androidStatusBarInset = Platform.OS === 'android'
    ? StatusBar.currentHeight ?? theme.spacing.xl
    : undefined;
  const androidBottomInset = Platform.OS === 'android'
    ? theme.spacing.sm
    : undefined;

  const filteredChats = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');

    if (!normalizedQuery) {
      return chatData;
    }

    return chatData.filter(({ userName, lastMessage }) =>
      `${userName} ${lastMessage}`.toLocaleLowerCase('vi-VN').includes(normalizedQuery),
    );
  }, [query]);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          paddingBottom: androidBottomInset,
          paddingTop: androidStatusBarInset,
        },
      ]}
    >
      <Header />
      <SearchBar onChangeText={setQuery} value={query} />
      <FlatList
        contentContainerStyle={styles.listContent}
        data={filteredChats}
        keyExtractor={(chat) => chat.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <ChatListItem chat={item} onPress={onChatPress} />}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
      <View pointerEvents="none" style={styles.bottomSpacer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  list: {
    backgroundColor: theme.colors.surface,
    flex: 1,
  },
  listContent: {
    paddingBottom: theme.layout.bottomPadding,
  },
  bottomSpacer: {
    backgroundColor: theme.colors.surface,
    height: theme.spacing.xs,
  },
});
