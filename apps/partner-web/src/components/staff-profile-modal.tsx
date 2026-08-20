'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { PartnerStaffMember } from '@lunara/types';
import { updateStaffProfile, uploadStaffAvatar } from '../lib/partner-api';

export function StaffProfileModal({
  staff,
  onClose,
  onSaved,
}: {
  staff: PartnerStaffMember;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [nameDraft, setNameDraft] = useState(staff.displayName ?? '');
  const [phoneDraft, setPhoneDraft] = useState(staff.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState(false);

  async function handleSave() {
    const trimmedName = nameDraft.trim();
    const trimmedPhone = phoneDraft.trim();
    setSaving(true);
    try {
      await updateStaffProfile(
        staff._id,
        trimmedName !== staff.displayName ? trimmedName : undefined,
        undefined,
        trimmedPhone !== (staff.phone ?? '') ? trimmedPhone : undefined,
      );
      await onSaved();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePermission() {
    setPermissionSaving(true);
    try {
      await updateStaffProfile(staff._id, undefined, !staff.canManageSettings);
      await onSaved();
      toast.success('Permission updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update permission');
    } finally {
      setPermissionSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      await uploadStaffAvatar(staff._id, file);
      await onSaved();
      toast.success('Photo updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload photo');
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Edit staff profile</h3>
        <p className="mt-1 text-sm text-muted">{staff.email ?? staff._id}</p>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {staff.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={staff.avatarUrl} alt={staff.displayName ?? staff.email} className="h-full w-full object-cover" />
            ) : (
              (staff.displayName ?? staff.email ?? '?')[0]?.toUpperCase()
            )}
          </div>
          <label className={`btn-outline btn-sm cursor-pointer ${avatarBusy ? 'pointer-events-none opacity-60' : ''}`}>
            {avatarBusy ? 'Uploading…' : 'Change photo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={avatarBusy}
              onChange={handleAvatarChange}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-900">Display name</span>
          <input
            type="text"
            className="input"
            placeholder="e.g. Juan Dela Cruz"
            value={nameDraft}
            maxLength={80}
            onChange={(e) => setNameDraft(e.target.value)}
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-900">Phone</span>
          <input
            type="tel"
            className="input"
            placeholder="+63917…"
            value={phoneDraft}
            onChange={(e) => setPhoneDraft(e.target.value)}
          />
        </label>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Settings access</p>
            <p className="text-xs text-muted">
              {staff.canManageSettings ? 'Can edit shop settings' : 'View-only — cannot edit shop settings'}
            </p>
          </div>
          <button
            type="button"
            className="btn-outline btn-sm"
            disabled={permissionSaving}
            onClick={() => void handleTogglePermission()}
          >
            {permissionSaving ? 'Saving…' : staff.canManageSettings ? 'Revoke' : 'Grant'}
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={
              saving ||
              !nameDraft.trim() ||
              (nameDraft.trim() === staff.displayName && phoneDraft.trim() === (staff.phone ?? ''))
            }
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
