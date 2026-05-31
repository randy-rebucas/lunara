import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

let online = true;

export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

export function getOnlineSnapshot(): boolean {
  return online;
}

export function initNetworkMonitor() {
  NetInfo.fetch().then((state) => {
    online = state.isConnected === true && state.isInternetReachable !== false;
  });
  return NetInfo.addEventListener((state) => {
    online = state.isConnected === true && state.isInternetReachable !== false;
  });
}

export function useNetworkStatus() {
  const [connected, setConnected] = useState(online);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const next = state.isConnected === true && state.isInternetReachable !== false;
      online = next;
      setConnected(next);
    });
    NetInfo.fetch().then((state) => {
      const next = state.isConnected === true && state.isInternetReachable !== false;
      online = next;
      setConnected(next);
    });
    return () => unsub();
  }, []);

  return connected;
}

/** Test helper */
export function setOnlineForTests(value: boolean) {
  online = value;
}
