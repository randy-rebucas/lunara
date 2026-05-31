import {
  StyleSheet,
  View,
  type RefreshControlProps,
  type ViewStyle,
} from 'react-native';
import type { ReactElement } from 'react';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { LaundryBackground } from './laundry-background';
import { KeyboardSafeScrollView } from './keyboard-safe-scroll-view';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Tab screens skip top safe inset and use tighter padding */
  inTab?: boolean;
  inStack?: boolean;
  centered?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  refreshControl?: ReactElement<RefreshControlProps>;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  inTab = false,
  inStack = false,
  centered = false,
  style,
  contentStyle,
  refreshControl,
}: ScreenProps) {
  const edges: Edge[] = inTab
    ? ['left', 'right']
    : inStack
      ? ['left', 'right', 'bottom']
      : ['top', 'left', 'right'];
  const paddingStyle = padded ? (inTab ? styles.tabPadded : inStack ? styles.stackPadded : styles.padded) : undefined;

  const inner = (
    <View style={[styles.flex, paddingStyle, centered && styles.centered, contentStyle]}>
      {children}
    </View>
  );

  return (
    <View style={[styles.root, style]}>
      <LaundryBackground />
      <SafeAreaView style={styles.safe} edges={edges}>
        {scroll ? (
          <KeyboardSafeScrollView
            contentContainerStyle={[styles.scrollContent, centered && styles.centered]}
            refreshControl={refreshControl}
            useTopSafeInset={!inStack && !inTab}
          >
            {padded ? <View style={[paddingStyle, contentStyle]}>{children}</View> : children}
          </KeyboardSafeScrollView>
        ) : (
          inner
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  padded: { flex: 1, padding: spacing.xl },
  tabPadded: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  stackPadded: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxxl },
  centered: { flex: 1, justifyContent: 'center' },
});
