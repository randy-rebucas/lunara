import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { appConfig, theme } from '@lunara/config';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{appConfig.name}</Text>
      <Text style={styles.subtitle}>{appConfig.tagline}</Text>
      <Link href="/(auth)/login" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Get Started</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: 24,
  },
  title: { fontSize: 36, fontWeight: '700', color: theme.colors.primary },
  subtitle: { marginTop: 8, fontSize: 16, color: theme.colors.muted },
  button: {
    marginTop: 32,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
