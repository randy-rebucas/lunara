import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { io } from 'socket.io-client';
import { OrderStatus } from '@lunara/types';
import {
  buildCustomerTimeline,
  formatCurrency,
  formatOrderStatusLabel,
} from '@lunara/utils';
import { theme } from '@lunara/config';
import { getApiOrigin } from '../../src/api-config';
import { DataLoadState } from '../../src/components/data-load-state';
import { OrderTimeline } from '../../src/components/order-timeline';
import { branchTypeLabel } from '../../src/components/nearest-branches';
import { ORDER_EVENT_MESSAGES } from '../../src/lib/order-events';
import { useAuthStore } from '../../src/store/auth';

interface OrderDetail {
  _id: string;
  status: string;
  total: number;
  bookingType: string;
  estimatedWeightKg?: number;
  scheduledPickupAt?: string;
  branchName?: string;
  branchCode?: string;
  statusHistory: { status: string; timestamp: string; note?: string }[];
}

interface DeliveryUiState {
  needsVerify: boolean;
  needsSign: boolean;
}

interface LiveNotification {
  id: string;
  message: string;
  at: string;
}

export default function OrderTrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [deliveryUi, setDeliveryUi] = useState<DeliveryUiState | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [socketLive, setSocketLive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [signatureName, setSignatureName] = useState('');
  const [deliveryError, setDeliveryError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);

  const pushNotification = useCallback((message: string) => {
    setNotifications((prev) => [
      { id: `${Date.now()}`, message, at: new Date().toISOString() },
      ...prev.slice(0, 14),
    ]);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError('');
    try {
      const data = await apiFetch<OrderDetail>(`/orders/${id}`);
      setOrder(data);

      if (
        data.status === OrderStatus.OUT_FOR_DELIVERY ||
        data.status === OrderStatus.RIDER_ASSIGNED_DELIVERY
      ) {
        try {
          const ui = await apiFetch<DeliveryUiState>(`/orders/${id}/delivery`);
          setDeliveryUi(ui);
        } catch {
          setDeliveryUi(null);
        }
      } else {
        setDeliveryUi(null);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load order');
      setOrder(null);
    } finally {
      setPageLoading(false);
    }
  }, [apiFetch, id]);

  useEffect(() => {
    setPageLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!id || !accessToken) return;

    const apiUrl = getApiOrigin();
    const socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });
    socket.emit('joinOrder', { orderId: id });
    setSocketLive(true);

    socket.on('orderStatusUpdate', (data: { status: string }) => {
      setOrder((prev) => (prev ? { ...prev, status: data.status } : prev));
      pushNotification(`Status: ${formatOrderStatusLabel(data.status)}`);
      void load();
    });

    socket.on('orderEvent', (data: { event: string; message?: string }) => {
      const msg = data.message ?? ORDER_EVENT_MESSAGES[data.event];
      if (msg) pushNotification(msg);
      void load();
    });

    socket.on('locationUpdate', (data: { lat: number; lng: number }) => {
      setLocation({ lat: data.lat, lng: data.lng });
    });

    return () => {
      setSocketLive(false);
      socket.disconnect();
    };
  }, [id, accessToken, load, pushNotification]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleVerify() {
    if (!id) return;
    setDeliveryError('');
    try {
      await apiFetch(`/orders/${id}/delivery/verify`, {
        method: 'POST',
        body: JSON.stringify({ code: verifyCode }),
      });
      setVerifyCode('');
      await load();
      pushNotification('Delivery verified');
    } catch (e) {
      setDeliveryError(e instanceof Error ? e.message : 'Verification failed');
    }
  }

  async function handleSign() {
    if (!id) return;
    setDeliveryError('');
    try {
      await apiFetch(`/orders/${id}/delivery/sign`, {
        method: 'POST',
        body: JSON.stringify({ signatureName }),
      });
      await load();
      pushNotification('Delivery signed');
    } catch (e) {
      setDeliveryError(e instanceof Error ? e.message : 'Sign failed');
    }
  }

  if (pageLoading || loadError || !order) {
    return (
      <View style={styles.centered}>
        <DataLoadState
          loading={pageLoading}
          error={loadError}
          loadingMessage="Loading order…"
          onRetry={() => {
            setPageLoading(true);
            load();
          }}
        />
      </View>
    );
  }

  const timeline = buildCustomerTimeline(order.status, order.statusHistory);
  const awaitingBranch =
    order.status === OrderStatus.PENDING_DISPATCH && !order.branchName;
  const hasBranch = Boolean(order.branchName);
  const showDeliveryActions =
    order.status === OrderStatus.OUT_FOR_DELIVERY ||
    order.status === OrderStatus.RIDER_ASSIGNED_DELIVERY;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.statusRow}>
        <Text style={styles.status}>{formatOrderStatusLabel(order.status)}</Text>
        {socketLive ? <Text style={styles.live}>● Live</Text> : null}
      </View>
      <Text style={styles.meta}>
        {order.bookingType.replace(/_/g, ' ')} · {formatCurrency(order.total)}
        {order.estimatedWeightKg ? ` · ~${order.estimatedWeightKg} kg` : ''}
      </Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${timeline.progressPercent}%` }]} />
      </View>
      <Text style={styles.progressLabel}>
        {timeline.currentStepLabel} · {timeline.progressPercent}%
      </Text>

      {awaitingBranch && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Assigning partner branch</Text>
          <Text style={styles.bannerText}>
            Payment received. Lunara HQ is dispatching your order to the best partner laundry shop.
          </Text>
        </View>
      )}

      {hasBranch && (
        <View style={styles.branchCard}>
          <Text style={styles.branchLabel}>Assigned partner branch</Text>
          <Text style={styles.branchName}>{order.branchName}</Text>
          {order.branchCode ? <Text style={styles.branchCode}>{order.branchCode}</Text> : null}
          <Text style={styles.branchHint}>{branchTypeLabel('partner_shop')}</Text>
        </View>
      )}

      {notifications.length > 0 && (
        <View style={styles.notifCard}>
          <Text style={styles.sectionTitle}>Updates</Text>
          {notifications.slice(0, 5).map((n) => (
            <Text key={n.id} style={styles.notifLine}>
              · {n.message}
            </Text>
          ))}
        </View>
      )}

      {location && (
        <View style={styles.locationCard}>
          <Text style={styles.sectionTitle}>Rider location</Text>
          <Text style={styles.locationText}>
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </Text>
        </View>
      )}

      {showDeliveryActions && deliveryUi?.needsVerify && (
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Confirm you received laundry</Text>
          <Text style={styles.actionHint}>Last 4 digits of your mobile number</Text>
          <TextInput
            style={styles.input}
            placeholder="4-digit code"
            keyboardType="number-pad"
            maxLength={4}
            value={verifyCode}
            onChangeText={setVerifyCode}
          />
          <Pressable style={styles.actionBtn} onPress={handleVerify}>
            <Text style={styles.actionBtnText}>Verify</Text>
          </Pressable>
        </View>
      )}

      {showDeliveryActions && deliveryUi?.needsSign && (
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Sign for delivery</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            value={signatureName}
            onChangeText={setSignatureName}
          />
          <Pressable style={styles.actionBtn} onPress={handleSign}>
            <Text style={styles.actionBtnText}>Sign</Text>
          </Pressable>
        </View>
      )}

      {deliveryError ? <Text style={styles.error}>{deliveryError}</Text> : null}

      <Text style={styles.sectionTitle}>Progress</Text>
      <OrderTimeline status={order.status} statusHistory={order.statusHistory} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#94a3b8' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { fontSize: 24, fontWeight: '700', flex: 1 },
  live: { fontSize: 12, fontWeight: '600', color: theme.colors.accent },
  meta: { marginTop: 6, color: '#64748b', fontSize: 15 },
  progressTrack: {
    marginTop: 16,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary },
  progressLabel: { marginTop: 6, fontSize: 12, color: '#64748b' },
  banner: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  bannerTitle: { fontWeight: '600', color: '#92400e' },
  bannerText: { marginTop: 6, fontSize: 13, color: '#78350f', lineHeight: 20 },
  branchCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  branchLabel: { fontSize: 12, fontWeight: '600', color: '#4338ca', textTransform: 'uppercase' },
  branchName: { marginTop: 4, fontSize: 18, fontWeight: '700', color: '#1e293b' },
  branchCode: { fontFamily: 'monospace', fontSize: 12, color: '#6366f1', marginTop: 2 },
  branchHint: { marginTop: 6, fontSize: 12, color: '#64748b' },
  notifCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notifLine: { fontSize: 13, color: '#475569', marginTop: 4 },
  locationCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  locationText: { marginTop: 4, fontSize: 13, color: '#334155' },
  actionCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: '#fafafa',
  },
  actionTitle: { fontWeight: '600', fontSize: 16 },
  actionHint: { marginTop: 4, fontSize: 13, color: '#64748b' },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  actionBtn: {
    marginTop: 10,
    backgroundColor: theme.colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '600' },
  error: { marginTop: 8, color: '#ef4444', fontSize: 13 },
  sectionTitle: { marginTop: 24, fontSize: 16, fontWeight: '600', marginBottom: 8 },
});
