import { StyleSheet, Text, View } from 'react-native';
import { BRANCH_TYPE_LABELS, type BranchNetworkType } from '@lunara/utils';
import { colors, radius, spacing } from '../theme';

export interface NearestBranchRow {
  branchId: string;
  code: string;
  name: string;
  city: string;
  distanceLabel: string;
  capacityAvailable: boolean;
  withinRadius: boolean;
  isNearest?: boolean;
}

interface NearestBranchesProps {
  branches: NearestBranchRow[];
  note?: string;
  branchTypes?: Record<string, BranchNetworkType>;
}

export function NearestBranchesCard({ branches, note }: NearestBranchesProps) {
  if (branches.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Lunara network near you</Text>
      <Text style={styles.sub}>
        Reference only — operations assigns your partner branch after payment.
      </Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {branches.slice(0, 4).map((b) => (
        <View key={b.branchId} style={styles.row}>
          <View style={styles.rowMain}>
            <Text style={styles.name}>
              {b.name}
              {b.isNearest ? ' · nearest' : ''}
            </Text>
            <Text style={styles.meta}>
              {b.code} · {b.city} · {b.distanceLabel}
            </Text>
          </View>
          <Text
            style={[
              styles.badge,
              b.capacityAvailable && b.withinRadius ? styles.badgeOk : styles.badgeWarn,
            ]}
          >
            {b.capacityAvailable && b.withinRadius ? 'Available' : 'Limited'}
          </Text>
        </View>
      ))}
      <Text style={styles.footer}>Lunara HQ → franchise & partner shops serve your area</Text>
    </View>
  );
}

export function branchTypeLabel(type?: string) {
  if (!type || !(type in BRANCH_TYPE_LABELS)) return 'Partner shop';
  return BRANCH_TYPE_LABELS[type as BranchNetworkType];
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    padding: spacing.lg - 2,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  title: { fontSize: 15, fontWeight: '600', color: colors.primaryDark },
  sub: { marginTop: spacing.xs, fontSize: 12, color: colors.muted },
  note: { marginTop: spacing.sm, fontSize: 12, color: colors.slate700, fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md - 2,
    paddingTop: spacing.md - 2,
    borderTopWidth: 1,
    borderTopColor: colors.primaryBorder,
  },
  rowMain: { flex: 1 },
  name: { fontSize: 14, fontWeight: '500', color: colors.slate800 },
  meta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  badge: { fontSize: 10, fontWeight: '600', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  badgeOk: { backgroundColor: colors.accentLight, color: colors.accentDark },
  badgeWarn: { backgroundColor: colors.warningBg, color: colors.warning },
  footer: { marginTop: spacing.md, fontSize: 11, color: colors.muted },
});
