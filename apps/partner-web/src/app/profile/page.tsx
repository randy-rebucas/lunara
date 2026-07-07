'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserRole, type PortalUser } from '@lunara/types';
import type { PartnerOwnProfile, PartnerSettingsData } from '@lunara/types';
import { AuthLoading } from '../../components/auth-loading';
import { Card, CardBody } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { useProtectedPage } from '../../hooks/use-protected-page';
import {
  getOwnProfile,
  getPortalUser,
  isPartnerRole,
  partnerFetch,
  removeOwnAvatar,
  staffLogout,
  updateOwnProfile,
  uploadOwnAvatar,
} from '../../lib/partner-api';
import { usePartnerQuery } from '../../lib/use-partner-query';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="text-sm text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}

function roleLabel(role?: PortalUser['role']) {
  if (role === UserRole.PARTNER) return 'Partner';
  if (role === UserRole.STAFF) return 'Staff';
  if (role === UserRole.ADMIN) return 'Admin';
  return role ?? '—';
}

export default function PortalProfilePage() {
  const router = useRouter();
  const { ready } = useProtectedPage({
    roles: [UserRole.PARTNER, UserRole.STAFF, UserRole.ADMIN],
  });
  const [user, setUser] = useState<PortalUser | null>(null);
  const partner = isPartnerRole();
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const loadShop = useCallback(() => partnerFetch<PartnerSettingsData>('/partner/settings'), []);
  const { data: shopData, loading: shopLoading, error: shopError } = usePartnerQuery(loadShop, [ready]);

  const loadProfile = useCallback(() => getOwnProfile(), []);
  const { data: profileData, reload: reloadProfile } = usePartnerQuery<PartnerOwnProfile>(
    loadProfile,
    [ready],
  );

  useEffect(() => {
    setUser(getPortalUser());
  }, []);

  useEffect(() => {
    setNameDraft(profileData?.displayName ?? '');
  }, [profileData?.displayName]);

  async function logout() {
    await staffLogout();
    router.replace('/login');
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === profileData?.displayName) return;
    setSavingName(true);
    try {
      await updateOwnProfile(trimmed);
      await reloadProfile();
      toast.success('Name updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update name');
    } finally {
      setSavingName(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      await uploadOwnAvatar(file);
      await reloadProfile();
      toast.success('Photo updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload photo');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarBusy(true);
    try {
      await removeOwnAvatar();
      await reloadProfile();
      toast.success('Photo removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove photo');
    } finally {
      setAvatarBusy(false);
    }
  }

  if (!ready) return <AuthLoading message="Loading profile…" />;

  const displayName = profileData?.displayName || user?.email || 'Portal user';
  const branch = shopData?.branch;

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Your signed-in portal account and shop branch."
      />

      <Card className="max-w-2xl">
        <CardBody>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xl font-semibold text-primary">
              {profileData?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileData.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                (displayName[0] ?? 'P').toUpperCase()
              )}
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">{displayName}</p>
              <p className="text-sm text-muted">{roleLabel(user?.role)}</p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border/60 pb-6">
            <label className={`btn-outline btn-sm cursor-pointer ${avatarBusy ? 'pointer-events-none opacity-60' : ''}`}>
              {avatarBusy ? 'Uploading…' : profileData?.avatarUrl ? 'Change photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={avatarBusy}
                onChange={handleAvatarChange}
              />
            </label>
            {profileData?.avatarUrl ? (
              <button
                type="button"
                className="btn-outline btn-sm"
                disabled={avatarBusy}
                onClick={() => void handleAvatarRemove()}
              >
                Remove photo
              </button>
            ) : null}
          </div>

          <div className="mb-6 flex flex-wrap items-end gap-2 border-b border-border/60 pb-6">
            <label className="flex-1 min-w-[180px]">
              <span className="mb-1 block text-sm font-medium text-slate-900">Display name</span>
              <input
                type="text"
                className="input"
                placeholder="e.g. Maria Santos"
                value={nameDraft}
                maxLength={80}
                onChange={(e) => setNameDraft(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={savingName || !nameDraft.trim() || nameDraft.trim() === profileData?.displayName}
              onClick={() => void saveName()}
            >
              {savingName ? 'Saving…' : 'Save name'}
            </button>
          </div>

          <dl>
            <DetailRow label="Email" value={user?.email ?? '—'} />
            <DetailRow label="Role" value={roleLabel(user?.role)} />
            <DetailRow
              label="Shop branch"
              value={
                shopLoading ? (
                  'Loading…'
                ) : branch ? (
                  <span>
                    {branch.name}{' '}
                    <span className="font-mono text-xs text-primary">({branch.code})</span>
                  </span>
                ) : shopError ? (
                  'Could not load branch'
                ) : (
                  '—'
                )
              }
            />
            {branch && (
              <DetailRow
                label="Address"
                value={`${branch.line1}, ${branch.city}, ${branch.province}`}
              />
            )}
          </dl>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-border/60 pt-6">
            <Link href="/settings" className="btn-outline">
              Shop settings
            </Link>
            {partner && (
              <Link href="/staff" className="btn-outline">
                Staff team
              </Link>
            )}
            <button type="button" onClick={logout} className="btn-ghost text-red-600">
              Sign out
            </button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
