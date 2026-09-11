'use client';

import { useCallback, useMemo, useState } from 'react';
import type { PartnerOwnedRider, PartnerStaffMember } from '@lunara/types';
import { DataPageStatus } from './data-page-status';
import { correctAttendanceRecord, getPartnerAttendanceSummary, listPartnerAttendance } from '../lib/partner-api';
import { usePartnerAttendanceSocket } from '../lib/use-partner-attendance-socket';
import { usePartnerQuery } from '../lib/use-partner-query';

/** `<input type="datetime-local">` wants "YYYY-MM-DDTHH:mm" in local time, not an ISO string. */
function toDateTimeLocalValue(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(clockInAt: string, clockOutAt?: string) {
  const end = clockOutAt ? new Date(clockOutAt) : new Date();
  const ms = end.getTime() - new Date(clockInAt).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

interface AttendanceTabProps {
  staff: PartnerStaffMember[];
  riders: PartnerOwnedRider[];
}

export function AttendanceTab({ staff, riders }: AttendanceTabProps) {
  const [roleFilter, setRoleFilter] = useState<'' | 'staff' | 'rider'>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'completed'>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSummary = useCallback(() => getPartnerAttendanceSummary(), []);
  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    reload: reloadSummary,
  } = usePartnerQuery(loadSummary, []);

  const loadRecords = useCallback(() => {
    return listPartnerAttendance({
      role: roleFilter || undefined,
      status: statusFilter || undefined,
      limit: 100,
    });
  }, [roleFilter, statusFilter]);

  const { data: records, loading, error, reload } = usePartnerQuery(loadRecords, [roleFilter, statusFilter]);

  usePartnerAttendanceSocket({
    onUpdate: () => {
      void reload();
      void reloadSummary();
    },
  });

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of staff) {
      map.set(s._id, s.displayName ?? s.email ?? s._id);
    }
    for (const r of riders) {
      map.set(r.userId, [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email || r.userId);
    }
    return map;
  }, [staff, riders]);

  function startEdit(recordId: string, clockInAt: string, clockOutAt?: string) {
    setEditingId(recordId);
    setEditClockIn(toDateTimeLocalValue(clockInAt));
    setEditClockOut(toDateTimeLocalValue(clockOutAt));
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError('');
  }

  async function saveEdit(recordId: string) {
    setSaving(true);
    setEditError('');
    try {
      await correctAttendanceRecord(recordId, {
        clockInAt: editClockIn ? new Date(editClockIn).toISOString() : undefined,
        clockOutAt: editClockOut ? new Date(editClockOut).toISOString() : null,
      });
      setEditingId(null);
      await reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save correction');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs text-muted">Staff clocked in</p>
          <p className="text-2xl font-semibold text-slate-900">{summary?.activeStaff ?? '—'}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted">Riders clocked in</p>
          <p className="text-2xl font-semibold text-slate-900">{summary?.activeRiders ?? '—'}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted">Staff hours today</p>
          <p className="text-2xl font-semibold text-slate-900">{summary?.totalStaffHoursToday ?? '—'}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted">Rider hours today</p>
          <p className="text-2xl font-semibold text-slate-900">{summary?.totalRiderHoursToday ?? '—'}</p>
        </div>
      </div>

      {summaryError && <div className="alert-error mt-4">{summaryError}</div>}
      {!summaryLoading && !summaryError && summary && (
        <p className="mt-2 text-xs text-muted">Workday: {summary.workDate} (Asia/Manila)</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
        >
          <option value="">All roles</option>
          <option value="staff">Staff</option>
          <option value="rider">Riders</option>
        </select>
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="">All statuses</option>
          <option value="active">Currently clocked in</option>
          <option value="completed">Completed shifts</option>
        </select>
      </div>

      {editError && <div className="alert-error mt-4">{editError}</div>}

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} onRetry={reload} loadingMessage="Loading attendance…" />
      </div>

      <div className="section-panel mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Clock in</th>
                <th>Clock out</th>
                <th>Duration</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(records ?? []).map((r) => {
                const isEditing = editingId === r._id;
                return (
                  <tr key={r._id}>
                    <td className="font-medium text-slate-900">
                      {nameByUserId.get(r.userId) ?? r.employeeEmail ?? r.userId}
                      {r.source === 'partner_correction' && (
                        <span className="ml-2 badge-neutral text-[10px]">corrected</span>
                      )}
                    </td>
                    <td>
                      <span className="badge-neutral capitalize">{r.role}</span>
                    </td>
                    {isEditing ? (
                      <>
                        <td>
                          <input
                            type="datetime-local"
                            className="rounded-lg border px-2 py-1 text-xs"
                            value={editClockIn}
                            onChange={(e) => setEditClockIn(e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="datetime-local"
                            className="rounded-lg border px-2 py-1 text-xs"
                            value={editClockOut}
                            onChange={(e) => setEditClockOut(e.target.value)}
                          />
                        </td>
                        <td className="text-muted">—</td>
                        <td>—</td>
                      </>
                    ) : (
                      <>
                        <td className="text-muted">{formatDateTime(r.clockInAt)}</td>
                        <td className="text-muted">{r.clockOutAt ? formatDateTime(r.clockOutAt) : '—'}</td>
                        <td className="text-muted">{formatDuration(r.clockInAt, r.clockOutAt)}</td>
                        <td>
                          <span className={r.status === 'active' ? 'badge-success' : 'badge-neutral'}>
                            {r.status === 'active' ? 'Active' : 'Completed'}
                          </span>
                        </td>
                      </>
                    )}
                    <td>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            disabled={saving}
                            onClick={() => void saveEdit(r._id)}
                          >
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button type="button" className="btn-outline btn-sm" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={() => startEdit(r._id, r.clockInAt, r.clockOutAt)}
                        >
                          Correct
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && !error && (records ?? []).length === 0 && (
          <p className="p-6 text-sm text-muted">No attendance records for this filter.</p>
        )}
      </div>
    </div>
  );
}
