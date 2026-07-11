import { Dimensions, Platform, StatusBar } from 'react-native';

import { theme } from '../theme';

export interface SystemInsets {
  bottom: number | undefined;
  top: number | undefined;
}

export function getSystemInsets(): SystemInsets {
  if (Platform.OS !== 'android') {
    return { bottom: undefined, top: undefined };
  }

  const screenHeight = Dimensions.get('screen').height;
  const windowHeight = Dimensions.get('window').height;
  const topInset = StatusBar.currentHeight ?? theme.spacing.xl;
  const reportedBottomInset = Math.max(screenHeight - windowHeight - topInset, 0);
  const bottomInset = Math.min(
    theme.layout.androidSystemBarMaximumInset,
    Math.max(theme.layout.androidSystemBarFallbackInset, reportedBottomInset),
  );

  return {
    bottom: bottomInset,
    top: topInset,
  };
}
