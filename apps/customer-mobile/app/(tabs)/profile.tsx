import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lunara/config';
import { useAuthStore } from '../../src/store/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Profile</Text>
      {user?.email ? <Text style={styles.meta}>{user.email}</Text> : null}
      {user?.phone ? <Text style={styles.meta}>{user.phone}</Text> : null}
      <Text style={styles.hint}>Addresses and notification settings are managed on the web app.</Text>
      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: theme.colors.background },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  meta: { fontSize: 15, color: '#334155', marginTop: 4 },
  hint: { marginTop: 20, fontSize: 13, color: '#94a3b8', lineHeight: 20 },
  logoutBtn: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: { color: '#64748b', fontWeight: '600' },
});
