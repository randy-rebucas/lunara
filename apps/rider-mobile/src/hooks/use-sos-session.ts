import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  queueGps,
  startSosLocationSharing,
  stopSosLocationSharing,
  triggerSosNotify,
} from '../api';
import { useRiderOperations } from '../context/rider-operations';
import { buildLocationPayload } from '../lib/rider-location';

async function readLocationPayload() {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const loc = await Location.getCurrentPositionAsync({});
  return buildLocationPayload(loc);
}

export function useSosSession(orderId: string | undefined, enabled: boolean) {
  const { emitSosLocation } = useRiderOperations();
  const [sharingActive, setSharingActive] = useState(false);
  const [dispatchNotified, setDispatchNotified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);

  const notifyDispatch = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const payload = await readLocationPayload();
      const result = await triggerSosNotify(
        orderId,
        payload?.latitude,
        payload?.longitude,
      );
      setIncidentId(result.incidentId);
      setDispatchNotified(true);
      Alert.alert('Dispatch notified', 'Operations has been alerted to your SOS.');
    } catch (err) {
      Alert.alert('SOS failed', err instanceof Error ? err.message : 'Could not notify dispatch');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const startSharing = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const payload = await readLocationPayload();
      const result = await startSosLocationSharing(
        orderId,
        payload?.latitude,
        payload?.longitude,
      );
      setIncidentId(result.incidentId);
      setSharingActive(true);
      Alert.alert('Live location sharing', 'Dispatch can see your location until you stop sharing.');
    } catch (err) {
      Alert.alert(
        'Sharing failed',
        err instanceof Error ? err.message : 'Could not start location sharing',
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const stopSharing = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      await stopSosLocationSharing(orderId);
      setSharingActive(false);
    } catch (err) {
      Alert.alert(
        'Stop failed',
        err instanceof Error ? err.message : 'Could not stop location sharing',
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!enabled || !orderId || !sharingActive) return;

    let cancelled = false;

    const tick = async () => {
      const payload = await readLocationPayload();
      if (cancelled || !payload) return;
      emitSosLocation(orderId, payload);
      await queueGps(payload, orderId);
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, orderId, sharingActive, emitSosLocation]);

  return {
    incidentId,
    sharingActive,
    dispatchNotified,
    loading,
    notifyDispatch,
    startSharing,
    stopSharing,
  };
}
