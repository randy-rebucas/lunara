import { StyleSheet, Text, View } from 'react-native';
import { BRANCH_TYPE_LABELS, type BranchNetworkType } from '@lunara/utils';

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
              b.capacityAvailable && b.withinRadius
                ? styles.badgeOk
                : styles.badgeWarn,
            ]}
          >
            {b.capacityAvailable && b.withinRadius ? 'Available' : 'Limited'}
          </Text>
        </View>
      ))}
      <Text style={styles.footer}>
        Lunara HQ → franchise & partner shops serve your area
      </Text>
    </View>
  );
}

export function branchTypeLabel(type?: string) {
  if (!type || !(type in BRANCH_TYPE_LABELS)) return 'Partner shop';
  return BRANCH_TYPE_LABELS[type as BranchNetworkType];
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  title: { fontSize: 15, fontWeight: '600', color: '#312e81' },
  sub: { marginTop: 4, fontSize: 12, color: '#475569' },
  note: { marginTop: 8, fontSize: 12, color: '#334155', fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#c7d2fe',
  },
  rowMain: { flex: 1 },
  name: { fontSize: 14, fontWeight: '500', color: '#1e293b' },
  meta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  badge: { fontSize: 10, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeOk: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeWarn: { backgroundColor: '#fef3c7', color: '#92400e' },
  footer: { marginTop: 12, fontSize: 11, color: '#64748b' },
});
