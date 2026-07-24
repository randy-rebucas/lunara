'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Button } from '@lunara/ui';
import { formatAddressTypeLabel } from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { PageShell } from '../../../components/page-shell';
import { AddressFormModal } from '../../../components/profile/address-form-modal';
import { ProfileAvatarUpload } from '../../../components/profile/profile-avatar-upload';
import { ShareInviteCard } from '../../../components/share/share-sections';
import { Card, CardBody } from '../../../components/ui/card';
import { FormLabel, Input } from '../../../components/ui/input';
import { PageHeader } from '../../../components/ui/page-header';
import { useProtectedPage } from '../../../hooks/use-protected-page';
import { useCustomerQuery } from '../../../lib/use-customer-query';
import type { AddressFormValues, CustomerAddress, CustomerProfile } from '../../../lib/profile-types';

export default function ProfilePage() {
  const { api, user, logout } = useAuthContext();
  const { isLoading, ready } = useProtectedPage({ requireOnboarding: true });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [addressSaving, setAddressSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [actioningAddressId, setActioningAddressId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [profileRes, addressesRes] = await Promise.all([
      api.get<CustomerProfile>('/customers/me'),
      api.get<CustomerAddress[]>('/addresses'),
    ]);
    setFirstName(profileRes.data.firstName);
    setLastName(profileRes.data.lastName);
    return { profile: profileRes.data, addresses: addressesRes.data };
  }, [api]);

  const { data, loading, error, reload } = useCustomerQuery(load, [ready, api]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading profile…" />;
  }

  const profile = data?.profile ?? null;
  const addresses = data?.addresses ?? [];

  async function uploadAvatar(file: File) {
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await api.upload<CustomerProfile>('/customers/me/avatar', formData);
      await reload();
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveProfile() {
    setProfileError('');
    setProfileSaved(false);
    if (!firstName.trim() || !lastName.trim()) {
      setProfileError('First and last name are required.');
      return;
    }
    setProfileSaving(true);
    try {
      await api.patch('/customers/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setProfileSaved(true);
      await reload();
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveAddress(values: AddressFormValues) {
    setAddressSaving(true);
    try {
      const payload = {
        label: values.label.trim(),
        addressType: values.addressType,
        line1: values.line1.trim(),
        line2: values.line2.trim() || undefined,
        city: values.city.trim(),
        province: values.province.trim(),
        postalCode: values.postalCode.trim(),
        isDefault: values.isDefault,
        ...(values.latitude != null && values.longitude != null
          ? { latitude: values.latitude, longitude: values.longitude }
          : {}),
      };
      if (editingAddress) {
        await api.patch(`/addresses/${editingAddress._id}`, payload);
      } else {
        await api.post('/addresses', payload);
      }
      await reload();
    } finally {
      setAddressSaving(false);
    }
  }

  async function deleteAddress(address: CustomerAddress) {
    if (!window.confirm(`Delete "${address.label}"?`)) return;
    setActioningAddressId(address._id);
    try {
      await api.delete(`/addresses/${address._id}`);
      await reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not delete address');
    } finally {
      setActioningAddressId(null);
    }
  }

  async function setDefaultAddress(address: CustomerAddress) {
    if (address.isDefault) return;
    setActioningAddressId(address._id);
    try {
      await api.patch(`/addresses/${address._id}`, { isDefault: true });
      await reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not update address');
    } finally {
      setActioningAddressId(null);
    }
  }

  const displayName =
    profile && profile.firstName !== 'Customer'
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : user?.email?.split('@')[0] ?? user?.phone ?? 'Customer';

  return (
    <PageShell>
      <PageHeader
        title="Profile"
        description="Manage your account, addresses, and preferences"
      />

      <DataPageStatus loading={loading} error={error} loadingMessage="Loading profile…" />

      {!loading && !error && (
        <>
          <Card className="mt-6">
            <CardBody className="text-center">
              <ProfileAvatarUpload
                name={displayName}
                avatarUrl={profile?.avatarUrl}
                uploading={avatarUploading}
                onUpload={uploadAvatar}
              />
              <p className="mt-1 text-lg font-semibold text-slate-900">{displayName}</p>
              {profile?.loyaltyPoints != null && profile.loyaltyPoints > 0 && (
                <p className="mt-1 text-sm font-medium text-primary">
                  {profile.loyaltyPoints.toLocaleString()} loyalty points
                </p>
              )}
              {user?.email && <p className="mt-1 text-sm text-muted">{user.email}</p>}
              {user?.phone && <p className="text-sm text-muted">{user.phone}</p>}
            </CardBody>
          </Card>

          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">Personal details</h2>
            <Card className="mt-4">
              <CardBody className="space-y-4">
                <div>
                  <FormLabel>First name</FormLabel>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={80} />
                </div>
                <div>
                  <FormLabel>Last name</FormLabel>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={80} />
                </div>
                {profileError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {profileError}
                  </div>
                )}
                {profileSaved && <p className="text-sm font-medium text-accent">Profile saved</p>}
                <Button onClick={saveProfile} disabled={profileSaving}>
                  {profileSaving ? 'Saving…' : 'Save profile'}
                </Button>
              </CardBody>
            </Card>
          </section>

          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight">Saved addresses</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingAddress(null);
                  setAddressModalOpen(true);
                }}
              >
                Add address
              </Button>
            </div>

            {addresses.length === 0 ? (
              <Card>
                <CardBody className="text-center text-muted">
                  No addresses yet.{' '}
                  <button
                    type="button"
                    className="link-primary"
                    onClick={() => {
                      setEditingAddress(null);
                      setAddressModalOpen(true);
                    }}
                  >
                    Add your first address
                  </button>
                </CardBody>
              </Card>
            ) : (
              <div className="list-stack">
                {addresses.map((address) => (
                  <Card key={address._id}>
                    <CardBody>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge-secondary">
                          {formatAddressTypeLabel(address.addressType)}
                        </span>
                        {address.isDefault && <span className="badge-primary">Default</span>}
                      </div>
                      <p className="mt-2 text-sm text-muted">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {address.city}, {address.province} {address.postalCode}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {!address.isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actioningAddressId === address._id}
                            onClick={() => setDefaultAddress(address)}
                          >
                            {actioningAddressId === address._id ? 'Working…' : 'Set default'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actioningAddressId === address._id}
                          onClick={() => {
                            setEditingAddress(address);
                            setAddressModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actioningAddressId === address._id}
                          onClick={() => deleteAddress(address)}
                        >
                          {actioningAddressId === address._id ? 'Working…' : 'Delete'}
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">Help & account</h2>
            <div className="mt-4 list-stack">
              <Link href="/support">
                <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
                  <CardBody>
                    <p className="font-medium text-slate-900">Support tickets</p>
                    <p className="mt-1 text-sm text-muted">Track lost-item reports and complaints</p>
                  </CardBody>
                </Card>
              </Link>
              <Link href="/refunds">
                <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
                  <CardBody>
                    <p className="font-medium text-slate-900">Refund requests</p>
                    <p className="mt-1 text-sm text-muted">View status from submission through payout</p>
                  </CardBody>
                </Card>
              </Link>
              <Link href="/notifications">
                <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
                  <CardBody>
                    <p className="font-medium text-slate-900">Notifications</p>
                    <p className="mt-1 text-sm text-muted">Order updates, reviews, and refund alerts</p>
                  </CardBody>
                </Card>
              </Link>
            </div>
          </section>

          <div className="mt-10">
            <ShareInviteCard />
          </div>

          <Button variant="outline" className="mt-8 w-full sm:w-auto" onClick={() => logout()}>
            Sign out
          </Button>
        </>
      )}

      <AddressFormModal
        open={addressModalOpen}
        editing={editingAddress}
        hasAddresses={addresses.length > 0}
        saving={addressSaving}
        onClose={() => setAddressModalOpen(false)}
        onSave={saveAddress}
      />
    </PageShell>
  );
}
