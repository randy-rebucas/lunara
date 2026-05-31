import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme';

/** Must match tab bar content height in app/(tabs)/_layout.tsx */
export const TAB_BAR_CONTENT_HEIGHT = 52;

export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? spacing.sm : 0);
  return TAB_BAR_CONTENT_HEIGHT + bottomInset;
}

/** Extra bottom padding for scroll content inside tab screens */
export function useTabScreenPadding(extra = spacing.lg) {
  return useTabBarHeight() + extra;
}
