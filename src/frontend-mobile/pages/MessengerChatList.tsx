import { useMemo, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';

import { chatData, KFC_ORDERING_BOT_ID, type ChatMessage } from '../chatData';
import { ChatListItem } from '../components/ChatListItem';
import { Header } from '../components/Header';
import { SearchBar } from '../components/SearchBar';
import { theme } from '../theme';
import { getSystemInsets } from '../utils/systemInsets';

interface MessengerChatListProps {
  onChatPress?: (chat: ChatMessage) => void;
}

export function MessengerChatList({ onChatPress }: MessengerChatListProps) {
  const [query, setQuery] = useState('');
  const systemInsets = getSystemInsets();

  const filteredChats = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');

    const bot = chatData.find((chat) => chat.id === KFC_ORDERING_BOT_ID);
    const matchingChats = chatData.filter(({ userName, lastMessage }) =>
      `${userName} ${lastMessage}`.toLocaleLowerCase('vi-VN').includes(normalizedQuery),
    );
    const otherChats = matchingChats.filter((chat) => chat.id !== KFC_ORDERING_BOT_ID);
    return bot ? [bot, ...otherChats] : otherChats;
  }, [query]);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          paddingBottom: systemInsets.bottom,
          paddingTop: systemInsets.top,
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
        renderItem={({ item }) => (
          <ChatListItem
            chat={item}
            onPress={item.id === KFC_ORDERING_BOT_ID ? onChatPress : undefined}
          />
        )}
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
