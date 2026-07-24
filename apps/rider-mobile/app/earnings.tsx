import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  formatCurrency,
  RIDER_DELIVERY_PAYOUT,
  RIDER_PICKUP_PAYOUT,
  type RiderEarningType,
} from '@lunara/utils';
import { DataLoadState } from '../src/components/data-load-state';
import { EarningTypeBadge } from '../src/components/earning-type-badge';
import { Screen } from '../src/components/ui/screen';
import { riderFetch } from '../src/api';
import type { EarningsData } from '../src/lib/rider-types';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface IncentiveCampaign {
  _id: string;
  title: string;
  description?: string;
  bonusAmount: number;
  thresholdDeliveries: number;
  endsAt: string;
  deliveryCount: number;
  credited: boolean;
}

function IncentiveCampaignCard({ campaign }: { campaign: IncentiveCampaign }) {
  const progress = Math.min(1, campaign.deliveryCount / campaign.thresholdDeliveries);
  return (
    <View style={incentiveStyles.card}>
      <View style={incentiveStyles.headerRow}>
        <Text style={incentiveStyles.title}>{campaign.title}</Text>
        <Text style={incentiveStyles.bonus}>{formatCurrency(campaign.bonusAmount)}</Text>
      </View>
      {campaign.description ? (
        <Text style={incentiveStyles.description}>{campaign.description}</Text>
      ) : null}
      <View style={incentiveStyles.progressTrack}>
        <View style={[incentiveStyles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={incentiveStyles.progressLabel}>
        {campaign.credited
          ? 'Bonus credited!'
          : `${campaign.deliveryCount} / ${campaign.thresholdDeliveries} deliveries`}
      </Text>
    </View>
  );
}

const incentiveStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.foreground, flex: 1 },
  bonus: { fontSize: 14, fontWeight: '800', color: colors.accentDark },
  description: { ...typography.bodySm, marginTop: spacing.xs },
  progressTrack: {
    marginTop: spacing.sm,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  progressLabel: { ...typography.caption, marginTop: spacing.xs },
});

// ── Period card ───────────────────────────────────────────────────────────────

function PeriodCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  valueColor,
}: {
  label: string;
  value: number;
  icon: IoniconName;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}) {
  return (
    <View style={periodStyles.card}>
      <View style={[periodStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={periodStyles.label}>{label}</Text>
      <Text style={[periodStyles.value, { color: valueColor }]}>{formatCurrency(value)}</Text>
    </View>
  );
}

const periodStyles = StyleSheet.create({
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  label: { ...typography.label },
  value: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});

// ── Activity stat ─────────────────────────────────────────────────────────────

function ActivityStat({
  count,
  label,
  rate,
  icon,
  iconBg,
  iconColor,
}: {
  count: number;
  label: string;
  rate: number;
  icon: IoniconName;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <View style={actStyles.card}>
      <View style={actStyles.top}>
        <View style={[actStyles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <Text style={actStyles.count}>{count}</Text>
      </View>
      <Text style={actStyles.label}>{label}</Text>
      <Text style={actStyles.rate}>₱{rate} per task</Text>
    </View>
  );
}

const actStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  rate: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
});

// ── Earning row ───────────────────────────────────────────────────────────────

function EarningRow({
  item,
}: {
  item: EarningsData['recentEarnings'][number];
}) {
  const ref = item.orderId
    ? `Order #${item.orderId.slice(-6).toUpperCase()}`
    : (item.note ?? 'Manual credit');
  const date = new Date(item.earnedAt).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.left}>
        <EarningTypeBadge type={item.type as RiderEarningType} />
        <Text style={rowStyles.ref}>{ref}</Text>
        <Text style={rowStyles.date}>{date}</Text>
      </View>
      <Text style={rowStyles.amount}>+{formatCurrency(item.amount)}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  left: {
    flex: 1,
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  ref: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  date: { ...typography.caption },
  amount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accentDark,
    letterSpacing: -0.3,
  },
});

// ── Earnings screen ───────────────────────────────────────────────────────────

export default function EarningsScreen() {
  const [data, setData] = useState<EarningsData>({
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    lifetimeEarnings: 0,
    totalEarnings: 0,
    todayPickups: 0,
    todayDeliveries: 0,
    recentEarnings: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [campaigns, setCampaigns] = useState<IncentiveCampaign[]>([]);

  const load = useCallback(async () => {
    setError('');
    try {
      const next = await riderFetch<EarningsData>('/riders/earnings');
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load earnings');
    } finally {
      setLoading(false);
    }
    riderFetch<IncentiveCampaign[]>('/riders/incentive-campaigns')
      .then(setCampaigns)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const lastIndex = data.recentEarnings.length - 1;
  type EarningItem = (typeof data.recentEarnings)[number];
  const renderEarningItem = useCallback(({ item, index }: { item: EarningItem; index: number }) => (
    <View style={styles.breakdownCard}>
      <EarningRow item={item} />
      {index < lastIndex ? <View style={styles.rowDivider} /> : null}
    </View>
  ), [lastIndex]);

  if (loading && !error) {
    return (
      <Screen inStack>
        <DataLoadState loading error="" loadingMessage="Loading earnings…" />
      </Screen>
    );
  }

  if (error && data.recentEarnings.length === 0 && data.lifetimeEarnings === 0) {
    return (
      <Screen inStack>
        <DataLoadState loading={false} error={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen inStack>
      <FlatList
        style={styles.list}
        data={data.recentEarnings}
        keyExtractor={(item, i) =>
          `${item.type}-${item.orderId ?? item.note ?? i}-${i}`
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Page header ── */}
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>My earnings</Text>
              <Text style={styles.pageSubtitle}>Track your payouts and task breakdown.</Text>
            </View>

            {/* ── Period grid ── */}
            <View style={styles.periodGrid}>
              <PeriodCard
                label="TODAY"
                value={data.todayEarnings}
                icon="wallet-outline"
                iconBg={colors.accentLight}
                iconColor={colors.accentDark}
                valueColor={colors.accentDark}
              />
              <PeriodCard
                label="THIS WEEK"
                value={data.weekEarnings}
                icon="calendar-outline"
                iconBg={colors.primaryLight}
                iconColor={colors.primary}
                valueColor={colors.primary}
              />
              <PeriodCard
                label="THIS MONTH"
                value={data.monthEarnings}
                icon="bar-chart-outline"
                iconBg="#EFF6FF"
                iconColor="#3B82F6"
                valueColor="#3B82F6"
              />
              <PeriodCard
                label="LIFETIME"
                value={data.lifetimeEarnings}
                icon="star-outline"
                iconBg={colors.warningBg}
                iconColor={colors.warning}
                valueColor={colors.warning}
              />
            </View>

            {/* ── Today's activity ── */}
            <Text style={styles.sectionLabel}>TODAY&apos;S ACTIVITY</Text>
            <View style={styles.activityRow}>
              <ActivityStat
                count={data.todayPickups}
                label="Pickups"
                rate={RIDER_PICKUP_PAYOUT}
                icon="arrow-up-circle-outline"
                iconBg={colors.primaryLight}
                iconColor={colors.primary}
              />
              <ActivityStat
                count={data.todayDeliveries}
                label="Deliveries"
                rate={RIDER_DELIVERY_PAYOUT}
                icon="arrow-down-circle-outline"
                iconBg={colors.accentLight}
                iconColor={colors.accentDark}
              />
            </View>

            {/* ── Incentives ── */}
            {campaigns.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>ACTIVE INCENTIVES</Text>
                {campaigns.map((c) => (
                  <IncentiveCampaignCard key={c._id} campaign={c} />
                ))}
              </>
            ) : null}

            {/* ── Breakdown header ── */}
            <Text style={styles.sectionLabel}>EARNINGS BREAKDOWN</Text>
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </>
        }
        renderItem={renderEarningItem}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="wallet-outline" size={28} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No earnings yet</Text>
            <Text style={styles.emptyHint}>Complete tasks to see your earnings here.</Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },

  pageHeader: { marginBottom: spacing.xl },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  pageSubtitle: { ...typography.bodySm, marginTop: spacing.xs },

  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
    marginBottom: spacing.xl,
  },

  sectionLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
  },

  activityRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginBottom: spacing.xl,
  },

  breakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    ...shadow.card,
    marginBottom: spacing.xs,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.destructive,
  },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  emptyHint: { ...typography.bodySm, textAlign: 'center' },
});
