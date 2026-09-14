import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../../theme';

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

// expo-auth-session's Google provider throws at hook-call time on iOS when iosClientId is
// missing — not configured yet (Android + web only for now), so the button must not even mount
// the hook there. A wrapper component (below) keeps that platform check out of the hook itself,
// since hooks can't be called conditionally.
export const GOOGLE_AUTH_SUPPORTED = !!WEB_CLIENT_ID && (Platform.OS !== 'ios' || !!IOS_CLIENT_ID);

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

function GoogleAuthButton({ onCredential, onError, disabled }: GoogleSignInButtonProps) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID || undefined,
    androidClientId: ANDROID_CLIENT_ID || undefined,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token ?? response.authentication?.idToken;
      if (idToken) onCredential(idToken);
      else onError('Google did not return a valid credential.');
    } else if (response.type === 'error') {
      onError('Google sign-in failed. Please try again.');
    }
    // 'dismiss'/'cancel' — user backed out, no error to surface.
  }, [response, onCredential, onError]);

  return (
    <Pressable
      onPress={() => void promptAsync()}
      disabled={disabled || !request}
      style={({ pressed }) => [styles.button, (disabled || !request) && styles.disabled, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
    >
      <Ionicons name="logo-google" size={18} color={colors.foreground} style={styles.icon} />
      <Text style={styles.text}>Continue with Google</Text>
    </Pressable>
  );
}

/** Google "Continue with" button — customer-facing sign-in only. Exchanges the Google ID token
 * for a Lunara session via onCredential; see AuthService.loginWithGoogle server-side. Renders
 * nothing when Google sign-in isn't configured for this build/platform (e.g. iOS before its
 * OAuth client id is registered). */
export function GoogleSignInButton(props: GoogleSignInButtonProps) {
  if (!GOOGLE_AUTH_SUPPORTED) return null;
  return <GoogleAuthButton {...props} />;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.88 },
  icon: { position: 'absolute', left: spacing.xl },
  text: { fontWeight: '600', fontSize: 15, color: colors.foreground, textAlign: 'center' },
});
