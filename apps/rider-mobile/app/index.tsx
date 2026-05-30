import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import { formatCurrency } from '@lunara/utils';
import { theme } from '@lunara/config';
import { getApiOrigin } from '../src/api-config';
import { riderFetch } from '../src/api';
import { riderLogout } from '../src/auth';
import { riderTaskStatusLabel } from '../src/rider-labels';
import { useAuthStore } from '../src/store/auth';

interface PickupOffer {
  _id: string;
  status: string;
  bookingType: string;
  scheduledPickupAt?: string;
  pickupAddress?: { label: string; city: string } | null;
}

interface DeliveryOffer {
  _id: string;
  status: string;
  bookingType: string;
  deliveryAddress?: { label: string; city: string } | null;
}

interface Task {
  _id: string;
  status: string;
  bookingType: string;
}

interface RiderMe {
  userId?: string;
  riderId?: string;
  isOnline: boolean;
  totalEarnings: number;
  todayEarnings: number;
  user?: { firstName: string; lastName: string } | null;
}

const DAILY_STEPS = [
  'Login',
  'Go online',
  'Receive assignment',
  'Accept task',
  'Navigate & complete',
];

export default function OperationsScreen() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const socketUserId = authUser?.id;

  const [me, setMe] = useState<RiderMe | null>(null);
  const [offers, setOffers] = useState<PickupOffer[]>([]);
  const [deliveryOffers, setDeliveryOffers] = useState<DeliveryOffer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const data = await riderFetch<RiderMe>('/riders/me');
      setMe(data);
    } catch {
      setMe(null);
    }
  }, []);

  const loadOffers = useCallback(async () => {
    try {
      const data = await riderFetch<PickupOffer[]>('/riders/pickup-offers');
      setOffers(data);
    } catch {
      setOffers([]);
    }
  }, []);

  const loadDeliveryOffers = useCallback(async () => {
    try {
      const data = await riderFetch<DeliveryOffer[]>('/riders/delivery-offers');
      setDeliveryOffers(data);
    } catch {
      setDeliveryOffers([]);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const data = await riderFetch<Task[]>('/riders/tasks');
      setTasks(data);
    } catch {
      setTasks([]);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await riderFetch<{ read: boolean }[]>('/riders/notifications');
      setUnreadCount(data.filter((n) => !n.read).length);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const refresh = useCallback(() => {
    loadMe();
    loadOffers();
    loadDeliveryOffers();
    loadTasks();
    loadNotifications();
  }, [loadMe, loadOffers, loadDeliveryOffers, loadTasks, loadNotifications]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!me?.isOnline || !accessToken) return;

    const userId = socketUserId ?? me.userId;
    const apiUrl = getApiOrigin();
    const socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });
    socket.emit('joinRiders');
    if (userId) socket.emit('joinRider', { userId });

    socket.on('pickupOffer', () => refresh());
    socket.on('pickupAssignment', () => {
      refresh();
      Alert.alert('New assignment', 'You have a new pickup task from Lunara.');
    });
    socket.on('deliveryOffer', () => refresh());
    socket.on('deliveryAssignment', () => {
      refresh();
      Alert.alert('New assignment', 'You have a new delivery task from Lunara.');
    });

    return () => {
      socket.disconnect();
    };
  }, [me?.isOnline, me?.userId, socketUserId, accessToken, refresh]);

  useEffect(() => {
    if (!activeOrderId || !me?.isOnline || !accessToken) return;

    const userId = socketUserId ?? me.userId;
    const apiUrl = getApiOrigin();
    const socket = io(`${apiUrl}/tracking`, {
      transports: ['websocket'],
      auth: { token: accessToken },
    });

    const interval = setInterval(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      if (userId) {
        socket.emit('riderLocation', {
          orderId: activeOrderId,
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          riderId: userId,
        });
      }
      await riderFetch('/riders/location', {
        method: 'PATCH',
        body: JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
      }).catch(() => {});
    }, 5000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [activeOrderId, me?.isOnline, me?.userId, socketUserId, accessToken]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        loadMe(),
        loadOffers(),
        loadDeliveryOffers(),
        loadTasks(),
        loadNotifications(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function goOnline() {
    await riderFetch('/riders/online', { method: 'POST' });
    await loadMe();
    refresh();
    Alert.alert('You are online', 'Waiting for pickup and delivery assignments…');
  }

  async function goOffline() {
    await riderFetch('/riders/offline', { method: 'POST' });
    setActiveOrderId(null);
    await loadMe();
  }

  async function acceptPickupOffer(orderId: string) {
    await riderFetch(`/riders/pickup-offers/${orderId}/accept`, { method: 'POST' });
    setActiveOrderId(orderId);
    router.push(`/pickup/${orderId}`);
  }

  function previewDeliveryQueue(orderId: string) {
    Alert.alert(
      'Awaiting assignment',
      'Delivery jobs are assigned by Lunara operations. When assigned, they appear under Active tasks.',
      [{ text: 'OK' }],
    );
    router.push(`/delivery/${orderId}`);
  }

  function openTask(orderId: string, status: string) {
    setActiveOrderId(orderId);
    if (
      status === 'rider_assigned_delivery' ||
      status === 'ready_for_delivery' ||
      status === 'out_for_delivery'
    ) {
      router.push(`/delivery/${orderId}`);
    } else {
      router.push(`/pickup/${orderId}`);
    }
  }

  async function handleLogout() {
    if (me?.isOnline) await goOffline().catch(() => {});
    await riderLogout();
    router.replace('/login');
  }

  const name = me?.user
    ? `${me.user.firstName} ${me.user.lastName}`.trim()
    : authUser?.email?.split('@')[0] ?? 'Rider';
  const online = me?.isOnline ?? false;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {name}</Text>
          <Text style={[styles.onlineBadge, online && styles.onlineBadgeOn]}>
            {online ? '● Online — receiving assignments' : '○ Offline'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Link href="/notifications" asChild>
            <Pressable style={styles.notifBtn}>
              <Text style={styles.notifBtnText}>Alerts</Text>
              {unreadCount > 0 && (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
          </Link>
          <Pressable onPress={handleLogout}>
            <Text style={styles.logout}>Logout</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.earningsRow}>
        <View style={styles.earnBox}>
          <Text style={styles.earnLabel}>Today</Text>
          <Text style={styles.earnValue}>{formatCurrency(me?.todayEarnings ?? 0)}</Text>
        </View>
        <View style={styles.earnBox}>
          <Text style={styles.earnLabel}>Total</Text>
          <Text style={styles.earnValue}>{formatCurrency(me?.totalEarnings ?? 0)}</Text>
        </View>
        <Link href="/earnings" asChild>
          <Pressable style={styles.earnLink}>
            <Text style={styles.earnLinkText}>Details →</Text>
          </Pressable>
        </Link>
      </View>

      {!online ? (
        <Pressable style={styles.goOnlineBtn} onPress={goOnline}>
          <Text style={styles.goOnlineText}>Go online</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.offlineBtn} onPress={goOffline}>
          <Text style={styles.offlineBtnText}>Go offline</Text>
        </Pressable>
      )}

      <Text style={styles.journeyTitle}>Daily flow</Text>
      <Text style={styles.journeySteps}>{DAILY_STEPS.join(' → ')}</Text>

      {online && (
        <>
          <Text style={styles.sectionTitle}>Pickup offers</Text>
          <FlatList
            data={offers}
            scrollEnabled={false}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.offerCard}
                onPress={() => acceptPickupOffer(item._id)}
              >
                <Text style={styles.type}>{item.bookingType.replace(/_/g, ' ')}</Text>
                <Text style={styles.address}>
                  {item.pickupAddress?.label ?? 'Address'} · {item.pickupAddress?.city ?? ''}
                </Text>
                {item.scheduledPickupAt && (
                  <Text style={styles.meta}>
                    Pickup:{' '}
                    {new Date(item.scheduledPickupAt).toLocaleString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                )}
                <Text style={styles.badge}>Accept pickup →</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No pickup offers — new bookings appear here</Text>
            }
          />

          <Text style={styles.sectionTitle}>Delivery queue</Text>
          <Text style={styles.sectionHint}>
            Orders ready at the shop — Lunara assigns you; then open from Active tasks.
          </Text>
          <FlatList
            data={deliveryOffers}
            scrollEnabled={false}
            keyExtractor={(item) => `d-${item._id}`}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.offerCard, styles.deliveryCard]}
                onPress={() => previewDeliveryQueue(item._id)}
              >
                <Text style={styles.type}>{item.bookingType.replace(/_/g, ' ')}</Text>
                <Text style={styles.address}>
                  {item.deliveryAddress?.label ?? 'Address'} · {item.deliveryAddress?.city ?? ''}
                </Text>
                <Text style={[styles.badge, { color: theme.colors.accent }]}>View details →</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No orders in delivery queue</Text>}
          />

          <Text style={styles.sectionTitle}>Active tasks</Text>
          <FlatList
            data={tasks}
            scrollEnabled={false}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <Pressable style={styles.card} onPress={() => openTask(item._id, item.status)}>
                <Text style={styles.type}>{item.bookingType.replace(/_/g, ' ')}</Text>
                <Text style={styles.address}>{riderTaskStatusLabel(item.status)}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No active tasks</Text>}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerActions: { alignItems: 'flex-end', gap: 8 },
  greeting: { fontSize: 20, fontWeight: '700' },
  onlineBadge: { marginTop: 4, fontSize: 13, color: '#94a3b8' },
  onlineBadgeOn: { color: theme.colors.accent, fontWeight: '600' },
  notifBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notifBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  badgeDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDotText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  logout: { color: '#64748b', fontSize: 14 },
  earningsRow: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'center' },
  earnBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  earnLabel: { fontSize: 11, color: '#64748b' },
  earnValue: { fontSize: 16, fontWeight: '700', color: theme.colors.primary, marginTop: 2 },
  earnLink: { padding: 8 },
  earnLinkText: { color: theme.colors.primary, fontWeight: '600', fontSize: 13 },
  goOnlineBtn: {
    marginTop: 16,
    backgroundColor: theme.colors.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  goOnlineText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  offlineBtn: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  offlineBtnText: { color: '#64748b', fontWeight: '600' },
  journeyTitle: { marginTop: 20, fontWeight: '700', fontSize: 14 },
  journeySteps: { marginTop: 4, fontSize: 11, color: '#64748b', lineHeight: 18 },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginBottom: 4, marginTop: 16 },
  sectionHint: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  offerCard: {
    backgroundColor: '#eef2ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  deliveryCard: { backgroundColor: '#ecfdf5', borderColor: theme.colors.accent },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.secondary,
  },
  type: { fontWeight: '700', fontSize: 16, textTransform: 'capitalize' },
  address: { marginTop: 4, color: '#64748b', textTransform: 'capitalize' },
  meta: { marginTop: 4, fontSize: 12, color: '#94a3b8' },
  badge: { marginTop: 8, fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#94a3b8', marginBottom: 16 },
});
