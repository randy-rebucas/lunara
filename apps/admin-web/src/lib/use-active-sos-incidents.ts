'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchActiveSosIncidents,
  resolveSosIncident,
  type ActiveSosIncident,
} from '../components/sos-incident-banner';
import type { DispatcherAlert, SosLocationUpdate } from './use-admin-operations-socket';

export function useActiveSosIncidents() {
  const [incidents, setIncidents] = useState<ActiveSosIncident[]>([]);
  const [liveAlert, setLiveAlert] = useState<DispatcherAlert | null>(null);
  const [liveLocations, setLiveLocations] = useState<Record<string, SosLocationUpdate>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState('');

  const reload = useCallback(async () => {
    try {
      const data = await fetchActiveSosIncidents();
      setIncidents(data);
    } catch {
      // keep existing list on failure
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onDispatcherAlert = useCallback((alert: DispatcherAlert) => {
    if (alert.type === 'rider_sos') {
      setLiveAlert(alert);
      void reload();
    }
  }, [reload]);

  const onSosLocationUpdate = useCallback((update: SosLocationUpdate) => {
    setLiveLocations((prev) => ({ ...prev, [update.incidentId]: update }));
    setIncidents((prev) =>
      prev.map((incident) =>
        incident.incidentId === update.incidentId
          ? {
              ...incident,
              locationSharingActive: true,
              lastLocation: {
                lat: update.lat,
                lng: update.lng,
                recordedAt: update.timestamp,
              },
            }
          : incident,
      ),
    );
  }, []);

  const handleResolve = useCallback(
    async (incidentId: string) => {
      setResolvingId(incidentId);
      setResolveError('');
      try {
        await resolveSosIncident(incidentId);
        setIncidents((prev) => prev.filter((i) => i.incidentId !== incidentId));
        if (liveAlert?.incidentId === incidentId) setLiveAlert(null);
        setLiveLocations((prev) => {
          const next = { ...prev };
          delete next[incidentId];
          return next;
        });
      } catch (e) {
        setResolveError(e instanceof Error ? e.message : 'Failed to resolve SOS incident');
      } finally {
        setResolvingId(null);
      }
    },
    [liveAlert],
  );

  return {
    incidents,
    liveAlert,
    liveLocations,
    resolvingId,
    resolveError,
    reload,
    onDispatcherAlert,
    onSosLocationUpdate,
    handleResolve,
    dismissLiveAlert: () => setLiveAlert(null),
  };
}
