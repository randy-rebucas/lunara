'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Button } from '@lunara/ui';
import { formatAddressTypeLabel, formatCurrency } from '@lunara/utils';
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
import type {
  AddressFormValues,
  BusinessSummary,
  CustomerAddress,
  CustomerProfile,
  FavoriteBranch,
  ImpactSummary,
} from '../../../lib/profile-types';

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
  const [actioningFavoriteId, setActioningFavoriteId] = useState<string | null>(null);
  const [businessSaving, setBusinessSaving] = useState(false);

  const load = useCallback(async () => {
    const [profileRes, addressesRes, favoritesRes, impactRes] = await Promise.all([
      api.get<CustomerProfile>('/customers/me'),
      api.get<CustomerAddress[]>('/addresses'),
      api.get<FavoriteBranch[]>('/favorites'),
      api.get<ImpactSummary>('/customers/me/impact'),
    ]);
    setFirstName(profileRes.data.firstName);
    setLastName(profileRes.data.lastName);
    let businessSummary: BusinessSummary | null = null;
    if (profileRes.data.isBusiness) {
      try {
        const summaryRes = await api.get<BusinessSummary>('/customers/me/business-summary');
        businessSummary = summaryRes.data;
      } catch {
        businessSummary = null;
      }
    }
    return {
      profile: profileRes.data,
      addresses: addressesRes.data,
      favorites: favoritesRes.data,
      impact: impactRes.data,
      businessSummary,
    };
  }, [api]);

  const { data, loading, error, reload } = useCustomerQuery(load, [ready, api]);

  if (isLoading || !ready) {
    return <AuthLoading message="Loading profile…" />;
  }

  const profile = data?.profile ?? null;
  const addresses = data?.addresses ?? [];
  const favorites = data?.favorites ?? [];
  const impact = data?.impact ?? null;
  const businessSummary = data?.businessSummary ?? null;

  async function removeFavorite(branchId: string) {
    setActioningFavoriteId(branchId);
    try {
      await api.delete(`/favorites/${branchId}`);
      await reload();
    } finally {
      setActioningFavoriteId(null);
    }
  }

  async function toggleBusiness() {
    if (!profile) return;
    setBusinessSaving(true);
    try {
      await api.patch('/customers/me', { isBusiness: !profile.isBusiness });
      await reload();
    } finally {
      setBusinessSaving(false);
    }
  }

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
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <p className="font-medium text-slate-900">Business account</p>
                    <p className="text-sm text-muted">Unlock a monthly order &amp; spend summary</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    disabled={businessSaving}
                    onClick={toggleBusiness}
                  >
                    {businessSaving ? 'Saving…' : profile?.isBusiness ? 'Enabled' : 'Enable'}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </section>

          {impact && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold tracking-tight">Your impact</h2>
              <Card className="mt-4">
                <CardBody>
                  <p className="text-sm text-muted">
                    {impact.totalWeightKg} kg laundered across {impact.orderCount} completed orders — an
                    estimated {impact.estimatedCo2SavedKg} kg CO2 saved vs. average home washing.
                  </p>
                </CardBody>
              </Card>
            </section>
          )}

          {profile?.isBusiness && businessSummary && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold tracking-tight">Business summary</h2>
              <Card className="mt-4">
                <CardBody>
                  <p className="text-sm text-muted">
                    Last 12 months: {businessSummary.totalOrders} orders ·{' '}
                    {formatCurrency(businessSummary.totalSpend)}
                  </p>
                  <div className="mt-4 list-stack-sm">
                    {businessSummary.months.map((m) => (
                      <div key={m.month} className="flex justify-between border-t border-border pt-2 text-sm">
                        <span className="font-medium text-slate-900">{m.month}</span>
                        <span className="text-muted">
                          {m.orderCount} orders · {formatCurrency(m.totalSpend)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </section>
          )}

          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight">Saved addresses</h2>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
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
                            className="min-h-11"
                            disabled={actioningAddressId === address._id}
                            onClick={() => setDefaultAddress(address)}
                          >
                            {actioningAddressId === address._id ? 'Working…' : 'Set default'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11"
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
                          className="min-h-11"
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
            <h2 className="text-lg font-semibold tracking-tight">Favorite shops</h2>
            {favorites.length === 0 ? (
              <Card className="mt-4">
                <CardBody className="text-center text-muted">
                  No favorites yet. Tap the heart on a shop while booking to save it here.
                </CardBody>
              </Card>
            ) : (
              <div className="mt-4 list-stack">
                {favorites.map((shop) => (
                  <Card key={shop.branchId}>
                    <CardBody className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{shop.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {shop.code} · {shop.city}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-11 shrink-0"
                        disabled={actioningFavoriteId === shop.branchId}
                        onClick={() => removeFavorite(shop.branchId)}
                      >
                        {actioningFavoriteId === shop.branchId ? 'Working…' : 'Remove'}
                      </Button>
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
              <Link href="/subscriptions">
                <Card className="transition-shadow hover:shadow-[var(--shadow-elevated)]">
                  <CardBody>
                    <p className="font-medium text-slate-900">Recurring pickups</p>
                    <p className="mt-1 text-sm text-muted">Manage your subscribed pickup schedules</p>
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
