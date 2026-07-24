import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { appConfig } from '@lunara/config';
import { Screen } from '../src/components/ui/screen';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const FAQ: { icon: IoniconName; q: string; a: string }[] = [
  {
    icon: 'power-outline',
    q: 'How do I go online for assignments?',
    a: 'Complete profile verification, then tap Start shift on the Home tab.',
  },
  {
    icon: 'radio-outline',
    q: 'Why am I not receiving pickup offers?',
    a: 'Ensure you are online, location is enabled, and you are not on break.',
  },
  {
    icon: 'wallet-outline',
    q: 'How do earnings reach my wallet?',
    a: 'Pickup and delivery payouts are credited automatically after task completion.',
  },
  {
    icon: 'call-outline',
    q: 'What if a customer is unreachable?',
    a: 'Use Call Customer on the task screen and contact dispatch if you need help.',
  },
];

// ── FAQ card ──────────────────────────────────────────────────────────────────

function FaqCard({ icon, q, a }: { icon: IoniconName; q: string; a: string }) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.iconWrap}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <View style={cardStyles.body}>
        <Text style={cardStyles.question}>{q}</Text>
        <Text style={cardStyles.answer}>{a}</Text>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  body: { flex: 1, gap: spacing.xs },
  question: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
    lineHeight: 20,
  },
  answer: { ...typography.bodySm, lineHeight: 20 },
});

// ── Contact row ───────────────────────────────────────────────────────────────

function ContactCard({
  icon,
  iconBg,
  iconColor,
  title,
  hint,
  actionLabel,
  actionIcon,
  danger,
  onPress,
  disabled,
}: {
  icon: IoniconName;
  iconBg: string;
  iconColor: string;
  title: string;
  hint: string;
  actionLabel?: string;
  actionIcon?: IoniconName;
  danger?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={contactStyles.card}>
      <View style={[contactStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={contactStyles.body}>
        <Text style={contactStyles.title}>{title}</Text>
        <Text style={contactStyles.hint}>{hint}</Text>
        {actionLabel && onPress ? (
          <Pressable
            style={({ pressed }) => [
              contactStyles.actionBtn,
              danger && contactStyles.actionBtnDanger,
              disabled && contactStyles.actionBtnDisabled,
              pressed && !disabled && contactStyles.actionBtnPressed,
            ]}
            onPress={onPress}
            disabled={disabled}
          >
            {actionIcon ? (
              <Ionicons name={actionIcon} size={14} color={danger ? '#fff' : colors.primary} />
            ) : null}
            <Text style={[contactStyles.actionText, danger && contactStyles.actionTextDanger]}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const contactStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, gap: spacing.xs },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  hint: { ...typography.bodySm, lineHeight: 20 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  actionBtnDanger: {
    borderColor: colors.destructive,
    backgroundColor: colors.destructive,
  },
  actionBtnDisabled: { opacity: 0.45 },
  actionBtnPressed: { opacity: 0.85 },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  actionTextDanger: { color: '#fff' },
});

// ── Support screen ────────────────────────────────────────────────────────────

export default function SupportScreen() {
  const router = useRouter();

  function contactSupport() {
    void Linking.openURL(`mailto:${appConfig.supportEmail}?subject=Lunara%20Rider%20Support`);
  }

  function callDispatch() {
    void Linking.openURL(`tel:${appConfig.supportPhone}`);
  }

  return (
    <Screen inStack scroll>
      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Help & support</Text>
        <Text style={styles.pageSubtitle}>Quick answers and ways to reach Lunara dispatch.</Text>
      </View>

      {/* ── FAQ ── */}
      <Text style={styles.sectionLabel}>FREQUENTLY ASKED</Text>
      {FAQ.map((item) => (
        <FaqCard key={item.q} icon={item.icon} q={item.q} a={item.a} />
      ))}

      {/* ── Contact ── */}
      <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>CONTACT US</Text>
      <ContactCard
        icon="clipboard-outline"
        iconBg={colors.primaryLight}
        iconColor={colors.primary}
        title="Report an issue"
        hint="Damaged item, delivery delay, or anything else — tracked by dispatch."
        actionLabel="Report an issue"
        actionIcon="arrow-forward-outline"
        onPress={() => router.push('/report-issue' as Href)}
      />
      <ContactCard
        icon="list-outline"
        iconBg={colors.accentLight}
        iconColor={colors.accentDark}
        title="My reports"
        hint="View the status of issues you've reported."
        actionLabel="View reports"
        actionIcon="arrow-forward-outline"
        onPress={() => router.push('/my-reports' as Href)}
      />
      <ContactCard
        icon="mail-outline"
        iconBg={colors.primaryLight}
        iconColor={colors.primary}
        title="Email support"
        hint={`Email ${appConfig.supportEmail} for account, payout, or verification issues.`}
        actionLabel="Send email"
        actionIcon="arrow-forward-outline"
        onPress={contactSupport}
      />
      <ContactCard
        icon="headset-outline"
        iconBg={colors.accentLight}
        iconColor={colors.accentDark}
        title="Dispatch hotline"
        hint="For active route issues, call dispatch during your shift."
        actionLabel="Call dispatch"
        actionIcon="call-outline"
        onPress={callDispatch}
      />
      <ContactCard
        icon="alert-circle-outline"
        iconBg="#FEF2F2"
        iconColor={colors.destructive}
        title="Emergency SOS"
        hint="Use the SOS button on pickup or delivery task screens to alert dispatch with your live location."
        actionLabel="Only available on task screens"
        disabled
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageHeader: { marginBottom: spacing.xl },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  pageSubtitle: { ...typography.bodySm, marginTop: spacing.xs },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm },
});
