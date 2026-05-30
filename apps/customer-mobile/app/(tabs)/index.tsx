import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lunara/config';
import { useAuthStore } from '../../src/store/auth';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const greeting = user?.email?.split('@')[0] ?? user?.phone ?? 'there';

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Hello, {greeting}</Text>
      <Text style={styles.sub}>
        Lunara assigns the best partner branch for your area. Book pickup and delivery in a few
        steps.
      </Text>
      <Pressable style={styles.button} onPress={() => router.push('/book')}>
        <Text style={styles.buttonText}>Book laundry</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => router.push('/(tabs)/orders')}>
        <Text style={styles.secondaryText}>View orders</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: theme.colors.background },
  heading: { fontSize: 24, fontWeight: '700' },
  sub: { marginTop: 8, color: '#64748b', marginBottom: 24, lineHeight: 22 },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  secondary: {
    marginTop: 12,
    padding: 14,
    alignItems: 'center',
  },
  secondaryText: { color: theme.colors.primary, fontWeight: '600' },
});
