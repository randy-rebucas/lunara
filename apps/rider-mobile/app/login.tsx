import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme, appConfig } from '@lunara/config';
import { riderLogin } from '../src/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('rider@lunara.dev');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      await riderLogin(email.trim(), password);
      router.replace('/');
    } catch (e) {
      Alert.alert('Login failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.brand}>{appConfig.name} Rider</Text>
      <Text style={styles.subtitle}>Daily operations — pickups & deliveries</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.btn} onPress={handleLogin} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Login'}</Text>
      </Pressable>

      <Text style={styles.devHint}>Dev: rider@lunara.dev / password123</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  brand: { fontSize: 28, fontWeight: '800', color: theme.colors.primary, textAlign: 'center' },
  subtitle: { marginTop: 8, marginBottom: 32, textAlign: 'center', color: '#64748b' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  btn: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  devHint: { marginTop: 24, textAlign: 'center', fontSize: 12, color: '#94a3b8' },
});
