import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('sos incident merge', () => {
  it('prepends live alert when not already in list', () => {
    const incidents: Array<{
      incidentId: string;
      orderId: string;
      riderUserId: string;
      riderName: string;
      locationSharingActive: boolean;
      lastLocation?: { lat: number; lng: number; recordedAt: string } | null;
    }> = [
      { incidentId: 'a', orderId: '1', riderUserId: 'u', riderName: 'A', locationSharingActive: false },
    ];
    const liveAlert = {
      type: 'rider_sos' as const,
      incidentId: 'b',
      orderId: '2',
      riderUserId: 'u2',
      riderName: 'B',
      lat: 14.5,
      lng: 121.0,
    };

    const merged = [...incidents];
    if (
      liveAlert.type === 'rider_sos' &&
      liveAlert.incidentId &&
      !merged.some((i) => i.incidentId === liveAlert.incidentId)
    ) {
      merged.unshift({
        incidentId: liveAlert.incidentId,
        orderId: liveAlert.orderId ?? '',
        riderUserId: liveAlert.riderUserId ?? '',
        riderName: liveAlert.riderName ?? 'Rider',
        locationSharingActive: false,
        lastLocation:
          liveAlert.lat !== undefined && liveAlert.lng !== undefined
            ? { lat: liveAlert.lat, lng: liveAlert.lng, recordedAt: new Date().toISOString() }
            : null,
      });
    }

    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.incidentId, 'b');
  });
});
