import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import { getApiOrigin } from '../api-config';
import { riderFetch } from '../api';
import { riderLogout } from '../auth';
import { useAuthStore } from '../store/auth';

export interface PickupOffer {
  _id: string;
  status: string;
  bookingType: string;
  scheduledPickupAt?: string;
  pickupAddress?: { label: string; city: string } | null;
}

export interface DeliveryOffer {
  _id: string;
  status: string;
  bookingType: string;
  deliveryAddress?: { label: string; city: string } | null;
}

export interface Task {
  _id: string;
  status: string;
  bookingType: string;
}

export interface RiderMe {
  userId?: string;
  riderId?: string;
  isOnline: boolean;
  totalEarnings: number;
  todayEarnings: number;
  user?: { firstName: string; lastName: string } | null;
}

export function getRouteProgressIndex(
  online: boolean,
  offers: PickupOffer[],
  deliveryOffers: DeliveryOffer[],
  tasks: Task[],
): number {
  if (tasks.length > 0) return 4;
  if (offers.length > 0 || deliveryOffers.length > 0) return 3;
  if (online) return 2;
  return 1;
}

interface RiderOperationsContextValue {
  me: RiderMe | null;
  offers: PickupOffer[];
  deliveryOffers: DeliveryOffer[];
  tasks: Task[];
  unreadCount: number;
  refreshing: boolean;
  name: string;
  online: boolean;
  routeProgressIndex: number;
  taskBadgeCount: number;
  refresh: () => void;
  onRefresh: () => Promise<void>;
  goOnline: () => Promise<void>;
  goOffline: () => Promise<void>;
  acceptPickupOffer: (orderId: string) => Promise<void>;
  previewDeliveryQueue: (orderId: string) => void;
  openTask: (orderId: string, status: string) => void;
  handleLogout: () => Promise<void>;
}

const RiderOperationsContext = createContext<RiderOperationsContextValue | null>(null);

export function RiderOperationsProvider({ children }: { children: ReactNode }) {
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
      Alert.alert('New assignment', 'You have a new pickup task from Lunara dispatch.');
    });
    socket.on('deliveryOffer', () => refresh());
    socket.on('deliveryAssignment', () => {
      refresh();
      Alert.alert('New assignment', 'You have a new delivery task from Lunara dispatch.');
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
    Alert.alert('Shift started', 'You are online and ready for assignments.');
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
      'Delivery jobs are assigned by Lunara dispatch. When assigned, they appear under Active tasks.',
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
  const routeProgressIndex = getRouteProgressIndex(online, offers, deliveryOffers, tasks);
  const taskBadgeCount = online ? offers.length + deliveryOffers.length + tasks.length : 0;

  const value: RiderOperationsContextValue = {
    me,
    offers,
    deliveryOffers,
    tasks,
    unreadCount,
    refreshing,
    name,
    online,
    routeProgressIndex,
    taskBadgeCount,
    refresh,
    onRefresh,
    goOnline,
    goOffline,
    acceptPickupOffer,
    previewDeliveryQueue,
    openTask,
    handleLogout,
  };

  return (
    <RiderOperationsContext.Provider value={value}>{children}</RiderOperationsContext.Provider>
  );
}

export function useRiderOperations() {
  const ctx = useContext(RiderOperationsContext);
  if (!ctx) {
    throw new Error('useRiderOperations must be used within RiderOperationsProvider');
  }
  return ctx;
}
