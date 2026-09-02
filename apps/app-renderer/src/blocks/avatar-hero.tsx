import { View, Text, Image, StyleSheet } from 'react-native';
import type { AvatarHeroProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function AvatarHero({ name, imageUrl, subtitle, editable }: AvatarHeroProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
          <Text style={[styles.initial, { color: theme.background }]}>{name.charAt(0)}</Text>
        </View>
      )}
      <Text style={[styles.name, { color: theme.foreground }]}>{name}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
      {editable ? <Text style={[styles.editLink, { color: theme.primary }]}>Edit profile</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 16, gap: 4 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  avatarPlaceholder: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 28, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  subtitle: { fontSize: 12 },
  editLink: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
