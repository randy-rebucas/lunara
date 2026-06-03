'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import { loadAdminSettings } from '../lib/admin-settings';
import { subscribeAdminRealtime } from '../lib/admin-realtime';
import { playSosAlertSound } from '../lib/admin-sos-sound';
import { useActiveSosIncidents } from '../lib/use-active-sos-incidents';
import type { DispatcherAlert } from '../lib/use-admin-operations-socket';

const AdminSosContext = createContext<ReturnType<typeof useActiveSosIncidents> | null>(null);

export function AdminSosProvider({ children }: { children: React.ReactNode }) {
  const sos = useActiveSosIncidents();
  const sosRef = useRef(sos);

  useEffect(() => {
    sosRef.current = sos;
  });

  useEffect(() => {
    return subscribeAdminRealtime({
      onDispatcherAlert: (alert: DispatcherAlert) => {
        if (alert.type !== 'rider_sos') return;
        sosRef.current.onDispatcherAlert(alert);
        if (loadAdminSettings().sosSoundAlerts) {
          playSosAlertSound();
        }
      },
      onSosLocationUpdate: (update) => {
        sosRef.current.onSosLocationUpdate(update);
      },
    });
  }, []);

  return <AdminSosContext.Provider value={sos}>{children}</AdminSosContext.Provider>;
}

export function useAdminSos() {
  const ctx = useContext(AdminSosContext);
  if (!ctx) throw new Error('useAdminSos must be used within AdminSosProvider');
  return ctx;
}
