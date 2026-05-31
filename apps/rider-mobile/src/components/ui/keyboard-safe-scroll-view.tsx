import { forwardRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';

type KeyboardSafeScrollViewProps = ScrollViewProps & {
  keyboardVerticalOffset?: number;
  useTopSafeInset?: boolean;
  avoiding?: boolean;
};

export const KeyboardSafeScrollView = forwardRef<ScrollView, KeyboardSafeScrollViewProps>(
  function KeyboardSafeScrollView(
    {
      children,
      contentContainerStyle,
      keyboardVerticalOffset = 0,
      useTopSafeInset = true,
      avoiding = true,
      style,
      ...props
    },
    ref,
  ) {
    const insets = useSafeAreaInsets();
    const offset =
      keyboardVerticalOffset + (useTopSafeInset && Platform.OS === 'ios' ? insets.top : 0);

    const scrollView = (
      <ScrollView
        ref={ref}
        style={[styles.flex, style]}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        {...props}
      >
        {children}
      </ScrollView>
    );

    if (!avoiding) return scrollView;

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={offset}
      >
        {scrollView}
      </KeyboardAvoidingView>
    );
  },
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.xxxl },
});
