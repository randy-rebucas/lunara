import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { LaundryBackground } from './laundry-background';
import { KeyboardSafeScrollView } from './keyboard-safe-scroll-view';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Tab screens already have a nav header — skip top inset and use tighter padding */
  inTab?: boolean;
  centered?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  inTab = false,
  centered = false,
  style,
  contentStyle,
}: ScreenProps) {
  const edges: Edge[] = inTab ? ['left', 'right'] : ['top', 'left', 'right'];
  const paddingStyle = padded ? (inTab ? styles.tabPadded : styles.padded) : undefined;

  const inner = (
    <View
      style={[
        styles.flex,
        paddingStyle,
        centered && styles.centered,
        contentStyle,
      ]}
    >
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
          >
            {padded ? (
              <View style={[paddingStyle, contentStyle]}>{children}</View>
            ) : (
              children
            )}
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
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxxl },
  centered: { flex: 1, justifyContent: 'center' },
});
