import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { OrderCardListProps } from '@lunara/blocks';
import { useTheme } from '../theme/theme-provider';

export function OrderCardList({ title, emptyStateText, orders, ctaLabel }: OrderCardListProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text> : null}
      {orders.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>{emptyStateText ?? 'No orders'}</Text>
      ) : (
        orders.map((order) => (
          <View key={order.id} style={[styles.card, { borderColor: theme.border }]}>
            <View style={styles.headerRow}>
              <Text style={[styles.orderNumber, { color: theme.foreground }]}>{order.orderNumber}</Text>
              <Text style={[styles.status, { color: theme.primary }]}>{order.status}</Text>
            </View>
            {order.branchName ? <Text style={[styles.meta, { color: theme.muted }]}>{order.branchName}</Text> : null}
            {order.itemsSummary ? (
              <Text style={[styles.meta, { color: theme.muted }]}>{order.itemsSummary}</Text>
            ) : null}
            {order.scheduledAt ? (
              <Text style={[styles.meta, { color: theme.muted }]}>{order.scheduledAt}</Text>
            ) : null}
            {order.showStepper ? (
              <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                <View style={[styles.progressFill, { backgroundColor: theme.primary }]} />
              </View>
            ) : null}
            {order.total ? <Text style={[styles.total, { color: theme.foreground }]}>{order.total}</Text> : null}
          </View>
        ))
      )}
      {ctaLabel ? (
        <Pressable style={[styles.cta, { borderColor: theme.primary }]}>
          <Text style={[styles.ctaLabel, { color: theme.primary }]}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, marginBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  orderNumber: { fontSize: 14, fontWeight: '700' },
  status: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  meta: { fontSize: 12, marginTop: 4 },
  progressTrack: { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 4, width: '60%', borderRadius: 2 },
  total: { fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'right' },
  cta: { alignSelf: 'center', marginTop: 4, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  ctaLabel: { fontSize: 13, fontWeight: '600' },
});
