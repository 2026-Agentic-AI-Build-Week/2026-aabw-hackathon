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
  };
  typography: {
    title: TextStyle;
    itemName: TextStyle;
    itemMessageRead: TextStyle;
    itemMessageUnread: TextStyle;
    meta: TextStyle;
    searchInput: TextStyle;
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
    statusDotSize: number;
    unreadBadgeSize: number;
    iconSmall: number;
    iconMedium: number;
    iconLarge: number;
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
    statusDotSize: 14,
    unreadBadgeSize: 10,
    iconSmall: 20,
    iconMedium: 24,
    iconLarge: 26,
    listItemVerticalPadding: 10,
    bottomPadding: 20,
  },
};
