import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { appConfig } from '@lunara/config';
import { Card } from '../src/components/ui/card';
import { Screen } from '../src/components/ui/screen';
import { SectionHeader } from '../src/components/ui/section-header';
import { colors, spacing, typography } from '../src/theme';

const FAQ = [
  {
    q: 'How do I go online for assignments?',
    a: 'Complete profile verification, then tap Start shift on the Home tab.',
  },
  {
    q: 'Why am I not receiving pickup offers?',
    a: 'Ensure you are online, location is enabled, and you are not on break.',
  },
  {
    q: 'How do earnings reach my wallet?',
    a: 'Pickup and delivery payouts are credited automatically after task completion.',
  },
  {
    q: 'What if a customer is unreachable?',
    a: 'Use Call Customer on the task screen and contact dispatch if you need help.',
  },
];

export default function SupportScreen() {
  function contactSupport() {
    void Linking.openURL(`mailto:${appConfig.supportEmail}?subject=Lunara%20Rider%20Support`);
  }

  function callDispatch() {
    void Linking.openURL('tel:+63281234567');
  }

  return (
    <Screen inStack scroll>
      <SectionHeader
        title="Help & support"
        hint="Quick answers and ways to reach Lunara dispatch."
      />

      {FAQ.map((item) => (
        <Card key={item.q} style={styles.card}>
          <Text style={styles.question}>{item.q}</Text>
          <Text style={styles.answer}>{item.a}</Text>
        </Card>
      ))}

      <Card style={styles.card}>
        <Text style={styles.question}>Contact support</Text>
        <Text style={styles.answer}>
          Email {appConfig.supportEmail} for account, payout, or verification issues.
        </Text>
        <Pressable onPress={contactSupport} style={styles.linkBtn}>
          <Text style={styles.linkText}>Email support →</Text>
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.question}>Dispatch hotline</Text>
        <Text style={styles.answer}>
          For active route issues, call dispatch during your shift.
        </Text>
        <Pressable onPress={callDispatch} style={styles.linkBtn}>
          <Text style={styles.linkText}>Call dispatch →</Text>
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <View style={styles.emergencyRow}>
          <Text style={styles.question}>Emergency SOS</Text>
          <Text style={styles.emergencyBadge}>Active tasks</Text>
        </View>
        <Text style={styles.answer}>
          Use the SOS button on pickup or delivery task screens to alert dispatch with your live
          location.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md, gap: spacing.sm },
  question: { ...typography.subheading, fontSize: 15 },
  answer: { ...typography.bodySm, lineHeight: 20 },
  linkBtn: { marginTop: spacing.sm },
  linkText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  emergencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emergencyBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.destructive,
    textTransform: 'uppercase',
  },
});
