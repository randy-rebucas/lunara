import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import type { Socket } from 'socket.io-client';
import { RIDER_GPS_UPDATE_INTERVAL_MS, type RiderLocationPayload } from '@lunara/utils';
import { riderFetch, queueGps } from '../api';
import { riderLogout } from '../auth';
import { useRiderDispatchSocket } from '../hooks/use-rider-dispatch-socket';
import { isOnline } from '../lib/offline/network';
import { buildLocationPayload, locationSocketPayload } from '../lib/rider-location';
import { getRouteProgressIndex } from '../lib/route-progress';
import type {
  ActiveAssignment,
  DeliveryOffer,
  EarningsData,
  PickupOffer,
  RiderMe,
  ShiftStatus,
  Task,
} from '../lib/rider-types';
import { useAuthStore } from '../store/auth';

interface RiderOperationsContextValue {
  me: RiderMe | null;
  offers: PickupOffer[];
  deliveryOffers: DeliveryOffer[];
  tasks: Task[];
  activeAssignment: ActiveAssignment | null;
  unreadCount: number;
  refreshing: boolean;
  locationDenied: boolean;
  name: string;
  online: boolean;
  shiftStatus: ShiftStatus;
  weekEarnings: number;
  monthEarnings: number;
  routeProgressIndex: number;
  taskBadgeCount: number;
  refresh: () => void;
  onRefresh: () => Promise<void>;
  goOnline: () => Promise<void>;
  goOffline: () => Promise<void>;
  startBreak: () => Promise<void>;
  endBreak: () => Promise<void>;
  acceptPickupOffer: (orderId: string) => Promise<void>;
  previewDeliveryQueue: (orderId: string) => void;
  openTask: (orderId: string, status: string) => void;
  requestLocationPermission: () => Promise<void>;
  handleLogout: () => Promise<void>;
  setUnreadCount: (count: number) => void;
  emitSosLocation: (orderId: string, payload: RiderLocationPayload) => void;
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
  const [activeAssignment, setActiveAssignment] = useState<ActiveAssignment | null>(null);
  const [weekEarnings, setWeekEarnings] = useState(0);
  const [monthEarnings, setMonthEarnings] = useState(0);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const socketRef = useRef<Socket | null>(null);

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

  const loadActiveAssignment = useCallback(async () => {
    try {
      const data = await riderFetch<ActiveAssignment | null>('/riders/active-assignment');
      setActiveAssignment(data);
      if (data?.orderId) {
        setActiveOrderId(data.orderId);
      }
    } catch {
      setActiveAssignment(null);
    }
  }, []);

  const loadEarnings = useCallback(async () => {
    try {
      const data = await riderFetch<EarningsData>('/riders/earnings');
      setWeekEarnings(data.weekEarnings);
      setMonthEarnings(data.monthEarnings);
    } catch {
      setWeekEarnings(0);
      setMonthEarnings(0);
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
    loadActiveAssignment();
    loadEarnings();
    loadNotifications();
  }, [loadMe, loadOffers, loadDeliveryOffers, loadTasks, loadActiveAssignment, loadEarnings, loadNotifications]);

  useEffect(() => {
    if (!accessToken) return;
    refresh();
  }, [accessToken, refresh]);

  const taskOrderIds = useMemo(() => tasks.map((task) => task._id), [tasks]);
  const userId = socketUserId ?? me?.userId ?? null;
  const shiftStatus: ShiftStatus =
    me?.shiftStatus ?? (me?.isOnline ? 'online' : 'offline');
  const online = shiftStatus === 'online';

  useRiderDispatchSocket(accessToken, userId, online, taskOrderIds, {
    onRefresh: refresh,
    onNotificationsSync: loadNotifications,
    onSocket: (socket) => {
      socketRef.current = socket;
    },
  });

  const requestLocationPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationDenied(status !== 'granted');
    if (status !== 'granted') {
      Alert.alert(
        'Location required',
        'Enable location access to go on shift and share your route during active tasks.',
      );
    }
  }, []);

  useEffect(() => {
    if (!activeOrderId || !online || !accessToken) return;

    const orderId = activeOrderId;
    const riderId = userId;
    if (!riderId) return;

    let cancelled = false;

    const tick = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      setLocationDenied(status !== 'granted');
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      if (cancelled) return;

      const payload = buildLocationPayload(loc);
      socketRef.current?.emit(
        'riderLocation',
        locationSocketPayload(payload, orderId, riderId),
      );

      await queueGps(payload, orderId);
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, RIDER_GPS_UPDATE_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeOrderId, online, userId, accessToken]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        loadMe(),
        loadOffers(),
        loadDeliveryOffers(),
        loadTasks(),
        loadActiveAssignment(),
        loadEarnings(),
        loadNotifications(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function goOnline() {
    if (!(await isOnline())) {
      Alert.alert('Offline', 'Connect to the internet to start your shift.');
      return;
    }

    const compliance = me?.compliance;
    if (compliance && !compliance.isCompliant) {
      const gaps = [...compliance.profileGaps, ...compliance.documentGaps];
      Alert.alert(
        'Complete verification first',
        gaps.length > 0 ? gaps.join('\n') : 'Finish your profile and document uploads before going online.',
        [
          ...(compliance.profileGaps.length > 0
            ? [{ text: 'Edit profile', onPress: () => router.push('/profile/edit') }]
            : []),
          { text: 'Documents', onPress: () => router.push('/documents') },
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationDenied(status !== 'granted');
    if (status !== 'granted') {
      Alert.alert(
        'Location required',
        'Allow location access before starting your shift so dispatch and customers can track active routes.',
      );
      return;
    }

    try {
      await riderFetch('/riders/online', { method: 'POST' });
      await loadMe();
      refresh();
      Alert.alert('Shift started', 'You are online and ready for assignments.');
    } catch (e) {
      Alert.alert('Cannot go online', e instanceof Error ? e.message : 'Verification incomplete.');
    }
  }

  async function goOffline() {
    if (!(await isOnline())) {
      Alert.alert('Offline', 'Connect to the internet to end your shift.');
      return;
    }

    await riderFetch('/riders/offline', { method: 'POST' });
    setActiveOrderId(null);
    await loadMe();
  }

  async function startBreak() {
    if (!(await isOnline())) {
      Alert.alert('Offline', 'Connect to the internet to update your shift.');
      return;
    }
    await riderFetch('/riders/break/start', { method: 'POST' });
    setActiveOrderId(null);
    await loadMe();
  }

  async function endBreak() {
    if (!(await isOnline())) {
      Alert.alert('Offline', 'Connect to the internet to resume your shift.');
      return;
    }
    await riderFetch('/riders/break/end', { method: 'POST' });
    await loadMe();
    refresh();
    Alert.alert('Shift resumed', 'You are online and ready for assignments.');
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
    if (shiftStatus === 'online' || shiftStatus === 'break') {
      await goOffline().catch(() => {});
    }
    await riderLogout();
    router.replace('/login');
  }

  const name = me?.user
    ? `${me.user.firstName} ${me.user.lastName}`.trim()
    : authUser?.email?.split('@')[0] ?? 'Rider';
  const routeProgressIndex = getRouteProgressIndex(online, offers, deliveryOffers, tasks);
  const taskBadgeCount = online ? offers.length + deliveryOffers.length + tasks.length : 0;

  const emitSosLocation = useCallback((orderId: string, payload: RiderLocationPayload) => {
    if (!socketUserId) return;
    const wire = locationSocketPayload(payload, orderId, socketUserId);
    socketRef.current?.emit('sosLocation', {
      orderId,
      lat: payload.latitude,
      lng: payload.longitude,
      latitude: payload.latitude,
      longitude: payload.longitude,
      speed: payload.speed,
      heading: payload.heading,
      timestamp: payload.timestamp,
    });
    socketRef.current?.emit('riderLocation', wire);
  }, [socketUserId]);

  const value: RiderOperationsContextValue = {
    me,
    offers,
    deliveryOffers,
    tasks,
    activeAssignment,
    unreadCount,
    refreshing,
    locationDenied,
    name,
    online,
    shiftStatus,
    weekEarnings,
    monthEarnings,
    routeProgressIndex,
    taskBadgeCount,
    refresh,
    onRefresh,
    goOnline,
    goOffline,
    startBreak,
    endBreak,
    acceptPickupOffer,
    previewDeliveryQueue,
    openTask,
    requestLocationPermission,
    handleLogout,
    setUnreadCount,
    emitSosLocation,
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
