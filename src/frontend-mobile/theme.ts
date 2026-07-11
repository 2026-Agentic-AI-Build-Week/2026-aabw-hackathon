import type { TextStyle } from 'react-native';

export interface ThemeTokens {
  colors: {
    primary: string;
    background: string;
    surface: string;
    surfaceContainer: string;
    surfaceVariant: string;
    textPrimary: string;
    textSecondary: string;
    unreadBadge: string;
    statusOnline: string;
    statusOffline: string;
    border: string;
    metaAi: string;
    chatBotBubble: string;
    chatUserBubble: string;
    chatUserText: string;
    chatCanvas: string;
    sendButton: string;
    loginBrand: string;
    loginInputBorder: string;
    loginPlaceholder: string;
    loginButtonDisabled: string;
  };
  typography: {
    title: TextStyle;
    itemName: TextStyle;
    itemMessageRead: TextStyle;
    itemMessageUnread: TextStyle;
    meta: TextStyle;
    searchInput: TextStyle;
    messageText: TextStyle;
    conversationName: TextStyle;
    messageStatus: TextStyle;
    loginInput: TextStyle;
    loginButton: TextStyle;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    circle: number;
  };
  layout: {
    headerHeight: number;
    headerActionSize: number;
    searchBarHeight: number;
    avatarSize: number;
    conversationAvatarSize: number;
    messageAvatarSize: number;
    statusDotSize: number;
    unreadBadgeSize: number;
    iconSmall: number;
    iconMedium: number;
    iconLarge: number;
    conversationHeaderHeight: number;
    inputBarButtonSize: number;
    inputBarHeight: number;
    messageBubbleMaxWidth: number;
    loginLogoSize: number;
    loginLogoIconSize: number;
    loginInputHeight: number;
    loginContentOffset: number;
    listItemVerticalPadding: number;
    bottomPadding: number;
  };
}

const fontFamily = 'Inter';

export const theme: ThemeTokens = {
  colors: {
    primary: '#005BB3',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceContainer: '#F3F3F8',
    surfaceVariant: '#E1E2E7',
    textPrimary: '#191C1F',
    textSecondary: '#717786',
    unreadBadge: '#2563EB',
    statusOnline: '#31A24C',
    statusOffline: '#C0C6D6',
    border: '#C0C6D6',
    metaAi: '#7E22CE',
    chatBotBubble: '#F0F2F5',
    chatUserBubble: '#0084FF',
    chatUserText: '#FFFFFF',
    chatCanvas: '#FFFFFF',
    sendButton: '#0084FF',
    loginBrand: '#0064E0',
    loginInputBorder: '#D1D5DB',
    loginPlaceholder: '#6B7280',
    loginButtonDisabled: '#93C5FD',
  },
  typography: {
    title: {
      fontFamily,
      fontSize: 24,
      lineHeight: 32,
      fontWeight: '700',
      letterSpacing: -0.48,
    },
    itemName: {
      fontFamily,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '400',
    },
    itemMessageRead: {
      fontFamily,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400',
    },
    itemMessageUnread: {
      fontFamily,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
    },
    meta: {
      fontFamily,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '400',
    },
    searchInput: {
      fontFamily,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400',
    },
    messageText: {
      fontFamily,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '400',
    },
    conversationName: {
      fontFamily,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '600',
      letterSpacing: -0.17,
    },
    messageStatus: {
      fontFamily,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
    },
    loginInput: {
      fontFamily,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '400',
    },
    loginButton: {
      fontFamily,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '500',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    circle: 9999,
  },
  layout: {
    headerHeight: 56,
    headerActionSize: 36,
    searchBarHeight: 40,
    avatarSize: 56,
    conversationAvatarSize: 40,
    messageAvatarSize: 28,
    statusDotSize: 14,
    unreadBadgeSize: 10,
    iconSmall: 20,
    iconMedium: 24,
    iconLarge: 26,
    conversationHeaderHeight: 64,
    inputBarButtonSize: 36,
    inputBarHeight: 36,
    messageBubbleMaxWidth: 75,
    loginLogoSize: 80,
    loginLogoIconSize: 48,
    loginInputHeight: 52,
    loginContentOffset: 64,
    listItemVerticalPadding: 10,
    bottomPadding: 20,
  },
};
