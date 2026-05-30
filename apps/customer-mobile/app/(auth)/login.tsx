import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '@lunara/config';
import { useAuthStore } from '../../src/store/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithOtp, loginWithEmail, requestOtp } = useAuthStore();
  const [mode, setMode] = useState<'otp' | 'email'>('otp');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('customer@lunara.dev');
  const [password, setPassword] = useState('password123');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');

  async function handleSendOtp() {
    setError('');
    try {
      const code = await requestOtp(phone);
      if (code) setDevOtp(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send OTP');
    }
  }

  async function handleLogin() {
    setError('');
    try {
      if (mode === 'email') {
        await loginWithEmail(email, password);
      } else {
        await loginWithOtp(phone, otp);
      }
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, mode === 'otp' && styles.modeBtnActive]}
          onPress={() => setMode('otp')}
        >
          <Text style={mode === 'otp' ? styles.modeTextActive : styles.modeText}>Phone OTP</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === 'email' && styles.modeBtnActive]}
          onPress={() => setMode('email')}
        >
          <Text style={mode === 'email' ? styles.modeTextActive : styles.modeText}>Email</Text>
        </Pressable>
      </View>
      {mode === 'email' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </>
      ) : null}
      {mode === 'otp' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="OTP"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
            />
            <Pressable style={styles.otpBtn} onPress={handleSendOtp}>
              <Text style={styles.otpBtnText}>Send</Text>
            </Pressable>
          </View>
          {devOtp ? <Text style={styles.devOtp}>Dev OTP: {devOtp}</Text> : null}
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Sign In</Text>
      </Pressable>
      <Text style={styles.devHint}>Dev OTP is always 123456 · email: customer@lunara.dev / password123</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 8 },
  otpBtn: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    marginBottom: 12,
  },
  otpBtnText: { color: '#fff', fontWeight: '600' },
  devOtp: { color: theme.colors.accent, marginBottom: 8 },
  error: { color: '#ef4444', marginBottom: 8 },
  button: {
    marginTop: 8,
    backgroundColor: theme.colors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  devHint: { marginTop: 16, textAlign: 'center', color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  modeBtnActive: { borderColor: theme.colors.primary, backgroundColor: '#eef2ff' },
  modeText: { color: '#64748b', fontWeight: '500' },
  modeTextActive: { color: theme.colors.primary, fontWeight: '600' },
});
