import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { DealsCarousel } from '../../src/components/deals-carousel';
import { NotificationsPreview } from '../../src/components/notifications-preview';
import { ShareInviteCard } from '../../src/components/social-share-buttons';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Screen } from '../../src/components/ui/screen';
import { colors, spacing, typography } from '../../src/theme';
import { useAuthStore } from '../../src/store/auth';
import { appConfig, getShareWebsiteUrl } from '@lunara/config';
import { buildAppSharePayload } from '@lunara/utils';

const QUICK_ACTIONS = [
  {
    title: 'Book laundry',
    desc: 'Schedule pickup & delivery',
    color: colors.primary,
    route: '/book' as const,
    variant: 'primary' as const,
  },
  {
    title: 'View orders',
    desc: 'Track active & past orders',
    color: colors.secondary,
    route: '/(tabs)/orders' as const,
    variant: 'outline' as const,
  },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const greeting = user?.email?.split('@')[0] ?? user?.phone ?? 'there';
  const invitePayload = buildAppSharePayload(getShareWebsiteUrl(), appConfig.name);

  return (
    <Screen inTab scroll>
      <Text style={styles.greeting}>Hello, {greeting}</Text>
      <Text style={styles.sub}>
        Lunara assigns the best partner branch for your area. Book pickup and delivery in a few
        steps.
      </Text>

      <DealsCarousel />

      <View style={styles.actions}>
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.title}
            label={action.title}
            variant={action.variant}
            onPress={() => router.push(action.route)}
            style={styles.actionBtn}
          />
        ))}
      </View>

      <View style={styles.cards}>
        <Card style={styles.infoCard}>
          <Text style={[styles.cardLabel, { color: colors.primary }]}>Book pickup</Text>
          <Text style={styles.cardDesc}>Choose service, address, and time slot</Text>
        </Card>
        <Card style={styles.infoCard}>
          <Text style={[styles.cardLabel, { color: colors.secondary }]}>Track orders</Text>
          <Text style={styles.cardDesc}>Live status updates from pickup to delivery</Text>
        </Card>
        <Card style={styles.infoCard}>
          <Text style={[styles.cardLabel, { color: colors.accent }]}>Pay securely</Text>
          <Text style={styles.cardDesc}>GCash, card, cash, or Lunara wallet</Text>
        </Card>
      </View>

      <ShareInviteCard payload={invitePayload} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { ...typography.title },
  sub: { ...typography.bodySm, marginTop: spacing.sm, marginBottom: spacing.xl },
  actions: { gap: spacing.md },
  actionBtn: { width: '100%' },
  cards: { gap: spacing.md, marginTop: spacing.xxxl },
  infoCard: { padding: spacing.lg },
  cardLabel: { fontSize: 14, fontWeight: '600' },
  cardDesc: { ...typography.caption, marginTop: spacing.xs },
});
