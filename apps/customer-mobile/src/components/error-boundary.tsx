import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { colors, radius, spacing, typography } from '../theme';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches uncaught render errors anywhere below it in the tree and shows a recoverable fallback
 * instead of letting the app crash to a native red/white screen. Wraps the root `<Stack>` in
 * `app/_layout.tsx` — this is a payments-carrying customer app, so an unhandled exception in any
 * one screen shouldn't take the whole app down with no way back. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No crash-reporting/telemetry integration exists in this app yet — this is the single place
    // to wire one in later (Sentry, Bugsnag, etc.) without touching every screen.
    void info;
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('Unhandled render error caught by ErrorBoundary:', error);
    }
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Card style={styles.card}>
            <View style={styles.icon}>
              <Ionicons name="alert-circle-outline" size={28} color={colors.destructive} />
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              An unexpected error occurred. You can try again, or restart the app if the problem
              continues.
            </Text>
            <Button label="Try again" onPress={this.handleReset} style={styles.button} />
          </Card>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surfaceMuted,
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.subheading, textAlign: 'center' },
  message: { ...typography.bodySm, color: colors.muted, textAlign: 'center' },
  button: { marginTop: spacing.md, width: '100%' },
});
