'use client';

import { createContext, useContext } from 'react';
import { SosIncidentBanner } from './sos-incident-banner';
import { useActiveSosIncidents } from '../lib/use-active-sos-incidents';
import { useAdminOperationsSocket } from '../lib/use-admin-operations-socket';

const AdminSosContext = createContext<ReturnType<typeof useActiveSosIncidents> | null>(null);

export function AdminSosProvider({ children }: { children: React.ReactNode }) {
  const sos = useActiveSosIncidents();

  useAdminOperationsSocket({
    onDispatcherAlert: (alert) => {
      if (alert.type === 'rider_sos') {
        sos.onDispatcherAlert(alert);
      }
    },
    onSosLocationUpdate: sos.onSosLocationUpdate,
  });

  return (
    <AdminSosContext.Provider value={sos}>
      {children}
      <div className="fixed bottom-4 right-4 z-40 w-full max-w-md px-4 sm:px-0">
        <SosIncidentBanner
          incidents={sos.incidents}
          liveAlert={sos.liveAlert}
          liveLocations={sos.liveLocations}
          resolvingId={sos.resolvingId}
          resolveError={sos.resolveError}
          onResolve={sos.handleResolve}
          onDismissAlert={sos.dismissLiveAlert}
        />
      </div>
    </AdminSosContext.Provider>
  );
}

export function useAdminSos() {
  const ctx = useContext(AdminSosContext);
  if (!ctx) throw new Error('useAdminSos must be used within AdminSosProvider');
  return ctx;
}
