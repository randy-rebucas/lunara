import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appConfig, getShareWebsiteUrl } from '@lunara/config';
import { buildAppSharePayload, formatAddressTypeLabel, formatCurrency } from '@lunara/utils';
import Constants from 'expo-constants';
import { AddressFormModal } from '../../src/components/address-form-modal';
import { ProfileAvatar } from '../../src/components/profile-avatar';
import { ShareInviteCard } from '../../src/components/social-share-buttons';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Input } from '../../src/components/ui/input';
import { KeyboardSafeScrollView } from '../../src/components/ui/keyboard-safe-scroll-view';
import { Screen } from '../../src/components/ui/screen';
import { DataLoadState } from '../../src/components/data-load-state';
import { useTabScreenPadding } from '../../src/hooks/use-tab-bar-height';
import {
  addressToForm,
  encodeAddressLine2,
  type AddressFormValues,
  type BusinessSummary,
  type CustomerAddress,
  type CustomerProfile,
  type FavoriteBranch,
  type ImpactSummary,
} from '../../src/lib/profile-types';
import { resolveMediaUrl } from '../../src/lib/media-url';
import { useAuthStore } from '../../src/store/auth';
import { brandName, colors, radius, spacing, typography } from '../../src/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const apiUpload = useAuthStore((s) => s.apiUpload);
  const logout = useAuthStore((s) => s.logout);
  const tabPadding = useTabScreenPadding();

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [addressSaving, setAddressSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [actioningAddressId, setActioningAddressId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoriteBranch[]>([]);
  const [actioningFavoriteId, setActioningFavoriteId] = useState<string | null>(null);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessSummary, setBusinessSummary] = useState<BusinessSummary | null>(null);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [profileData, addressList, favoriteList, impactData] = await Promise.all([
        apiFetch<CustomerProfile>('/customers/me'),
        apiFetch<CustomerAddress[]>('/addresses'),
        apiFetch<FavoriteBranch[]>('/favorites'),
        apiFetch<ImpactSummary>('/customers/me/impact'),
      ]);
      setProfile(profileData);
      setFirstName(profileData.firstName);
      setLastName(profileData.lastName);
      setAddresses(addressList);
      setFavorites(favoriteList);
      setImpact(impactData);
      if (profileData.isBusiness) {
        apiFetch<BusinessSummary>('/customers/me/business-summary')
          .then(setBusinessSummary)
          .catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  async function toggleBusiness() {
    if (!profile) return;
    const next = !profile.isBusiness;
    setBusinessSaving(true);
    try {
      const updated = await apiFetch<CustomerProfile>('/customers/me', {
        method: 'PATCH',
        body: JSON.stringify({ isBusiness: next }),
      });
      setProfile(updated);
      if (next) {
        apiFetch<BusinessSummary>('/customers/me/business-summary')
          .then(setBusinessSummary)
          .catch(() => {});
      } else {
        setBusinessSummary(null);
      }
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusinessSaving(false);
    }
  }

  async function removeFavorite(branchId: string) {
    setActioningFavoriteId(branchId);
    try {
      await apiFetch(`/favorites/${branchId}`, { method: 'DELETE' });
      setFavorites((prev) => prev.filter((f) => f.branchId !== branchId));
    } catch (e) {
      Alert.alert('Could not remove favorite', e instanceof Error ? e.message : 'Try again');
    } finally {
      setActioningFavoriteId(null);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function uploadAvatar(formData: FormData) {
    setAvatarUploading(true);
    try {
      const updated = await apiUpload<CustomerProfile>('/customers/me/avatar', formData);
      setProfile(updated);
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
      const updated = await apiFetch<CustomerProfile>('/customers/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      setProfile(updated);
      setProfileSaved(true);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Could not save profile');
    } finally {
      setProfileSaving(false);
    }
  }

  function openAddAddress() {
    setEditingAddress(null);
    setAddressModalOpen(true);
  }

  function openEditAddress(address: CustomerAddress) {
    setEditingAddress(address);
    setAddressModalOpen(true);
  }

  async function saveAddress(values: AddressFormValues) {
    setAddressSaving(true);
    try {
      const payload = {
        label: values.label.trim(),
        addressType: values.addressType,
        line1: values.line1.trim(),
        line2: encodeAddressLine2(values),
        city: values.city.trim(),
        province: values.province.trim(),
        postalCode: values.postalCode.trim(),
        isDefault: values.isDefault,
        ...(values.latitude != null && values.longitude != null
          ? { latitude: values.latitude, longitude: values.longitude }
          : {}),
      };

      if (editingAddress) {
        await apiFetch<CustomerAddress>(`/addresses/${editingAddress._id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<CustomerAddress>('/addresses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      await load();
    } finally {
      setAddressSaving(false);
    }
  }

  function confirmDeleteAddress(address: CustomerAddress) {
    Alert.alert('Remove address', `Delete "${address.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setActioningAddressId(address._id);
          try {
            await apiFetch(`/addresses/${address._id}`, { method: 'DELETE' });
            await load();
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again');
          } finally {
            setActioningAddressId(null);
          }
        },
      },
    ]);
  }

  async function setDefaultAddress(address: CustomerAddress) {
    if (address.isDefault) return;
    setActioningAddressId(address._id);
    try {
      await apiFetch(`/addresses/${address._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isDefault: true }),
      });
      await load();
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again');
    } finally {
      setActioningAddressId(null);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  const privacyUrl =
    (Constants.expoConfig?.extra?.privacyUrl as string | undefined) ?? `${getShareWebsiteUrl()}/privacy`;
  const termsUrl =
    (Constants.expoConfig?.extra?.termsUrl as string | undefined) ?? `${getShareWebsiteUrl()}/terms`;

  function openUrl(url: string) {
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open link', url);
    });
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'Your account and order history will be permanently removed. Contact support to confirm deletion.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email support',
          style: 'destructive',
          onPress: () => {
            const subject = encodeURIComponent('Account deletion request');
            const body = encodeURIComponent(
              `Please delete my ${brandName} customer account and associated personal data.`,
            );
            void Linking.openURL(`mailto:${appConfig.supportEmail}?subject=${subject}&body=${body}`);
          },
        },
      ],
    );
  }

  const displayName =
    profile && profile.firstName !== 'Customer'
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : user?.email?.split('@')[0] ?? user?.phone ?? 'Customer';

  return (
    <Screen inTab padded={false}>
      <KeyboardSafeScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabPadding }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <DataLoadState
          loading={loading && !refreshing}
          error={error}
          loadingMessage="Loading profile…"
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />

        {!loading && !error ? (
          <>
            <Card style={styles.heroCard}>
              <ProfileAvatar
                name={displayName}
                avatarUrl={profile?.avatarUrl}
                uploading={avatarUploading}
                onUpload={uploadAvatar}
              />
              <Text style={styles.heroName}>{displayName}</Text>
              {user?.email ? <Text style={styles.heroMeta}>{user.email}</Text> : null}
              {user?.phone ? <Text style={styles.heroMeta}>{user.phone}</Text> : null}
            </Card>

            <Text style={styles.sectionTitle}>Personal details</Text>
            <Card style={styles.sectionCard}>
              <Text style={styles.fieldLabel}>First name</Text>
              <Input value={firstName} onChangeText={setFirstName} placeholder="First name" maxLength={80} />
              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Last name</Text>
              <Input value={lastName} onChangeText={setLastName} placeholder="Last name" maxLength={80} />
              {profileError ? <Text style={styles.inlineError}>{profileError}</Text> : null}
              {profileSaved ? (
                <Text style={styles.inlineSuccess}>Profile saved</Text>
              ) : null}
              <Button
                label={profileSaving ? 'Saving…' : 'Save profile'}
                onPress={saveProfile}
                disabled={profileSaving}
                style={styles.sectionBtn}
              />
              <Pressable
                onPress={toggleBusiness}
                disabled={businessSaving}
                style={({ pressed }) => [styles.prefRow, pressed && styles.prefRowPressed]}
                accessibilityRole="switch"
                accessibilityState={{ checked: Boolean(profile?.isBusiness) }}
              >
                <Ionicons name="briefcase-outline" size={20} color={colors.secondary} />
                <View style={styles.prefCopy}>
                  <Text style={styles.prefTitle}>Business account</Text>
                  <Text style={styles.prefHint}>Unlock a monthly order & spend summary</Text>
                </View>
                <Ionicons
                  name={profile?.isBusiness ? 'toggle' : 'toggle-outline'}
                  size={28}
                  color={profile?.isBusiness ? colors.primary : colors.mutedForeground}
                />
              </Pressable>
            </Card>

            {impact ? (
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Your impact</Text>
                <Text style={styles.prefHint}>
                  {impact.totalWeightKg} kg laundered across {impact.orderCount} completed orders —
                  an estimated {impact.estimatedCo2SavedKg} kg CO2 saved vs. average home washing.
                </Text>
              </Card>
            ) : null}

            {profile?.isBusiness && businessSummary ? (
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Business summary</Text>
                <Text style={styles.prefHint}>
                  Last 12 months: {businessSummary.totalOrders} orders ·{' '}
                  {formatCurrency(businessSummary.totalSpend)}
                </Text>
                {businessSummary.months.map((m) => (
                  <View key={m.month} style={styles.businessRow}>
                    <Text style={styles.businessRowLabel}>{m.month}</Text>
                    <Text style={styles.businessRowMeta}>
                      {m.orderCount} orders · {formatCurrency(m.totalSpend)}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : null}

            <View style={[styles.sectionHeader, styles.sectionTitleSpaced]}>
              <Text style={styles.sectionTitle}>Saved addresses</Text>
              <Pressable
                onPress={openAddAddress}
                style={({ pressed }) => [styles.addLink, pressed && styles.linkPressed]}
                accessibilityRole="button"
                accessibilityLabel="Add address"
                hitSlop={14}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.addLinkText}>Add</Text>
              </Pressable>
            </View>

            {addresses.length === 0 ? (
              <Card muted style={styles.emptyAddressCard}>
                <Text style={styles.emptyTitle}>No addresses yet</Text>
                <Text style={styles.emptyHint}>
                  Add a pickup address with GPS for accurate routing on mobile.
                </Text>
                <Button label="Add address" variant="outline" onPress={openAddAddress} style={styles.sectionBtn} />
              </Card>
            ) : (
              addresses.map((address) => {
                const parsed = addressToForm(address);
                return (
                <Card key={address._id} style={styles.addressCard}>
                  <View style={styles.addressTop}>
                    <View style={styles.addressMain}>
                      <View style={styles.addressLabelRow}>
                        <Text style={styles.addressLabel}>{address.label}</Text>
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>
                            {formatAddressTypeLabel(address.addressType)}
                          </Text>
                        </View>
                        {address.isDefault ? (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.addressLine}>{address.line1}</Text>
                      {parsed.line2 ? <Text style={styles.addressLine}>{parsed.line2}</Text> : null}
                      {parsed.landmark ? (
                        <Text style={styles.addressMeta}>Landmark: {parsed.landmark}</Text>
                      ) : null}
                      {parsed.notes ? (
                        <Text style={styles.addressMeta}>Notes: {parsed.notes}</Text>
                      ) : null}
                      <Text style={styles.addressMeta}>
                        {address.city}, {address.province} {address.postalCode}
                      </Text>
                      {address.latitude != null && address.longitude != null ? (
                        <View style={styles.gpsRow}>
                          <Ionicons name="location-sharp" size={12} color={colors.accent} />
                          <Text style={styles.gpsText}>GPS pinned</Text>
                        </View>
                      ) : null}
                      {address.latitude != null && address.longitude != null ? (
                        <Pressable
                          onPress={() =>
                            Linking.openURL(
                              `https://www.google.com/maps/search/?api=1&query=${address.latitude},${address.longitude}`,
                            )
                          }
                          style={({ pressed }) => [styles.mapsLink, pressed && styles.linkPressed]}
                          accessibilityRole="button"
                          accessibilityLabel="Open address in Google Maps"
                          hitSlop={14}
                        >
                          <Ionicons name="map-outline" size={12} color={colors.primary} />
                          <Text style={styles.mapsLinkText}>Open in Google Maps</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.addressActions}>
                    {!address.isDefault ? (
                      <Pressable
                        onPress={() => setDefaultAddress(address)}
                        disabled={actioningAddressId === address._id}
                        style={({ pressed }) => [
                          styles.actionChip,
                          pressed && styles.actionChipPressed,
                          actioningAddressId === address._id && styles.actionChipDisabled,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Set ${address.label} as default address`}
                        hitSlop={{ top: 9, bottom: 9, left: 4, right: 4 }}
                      >
                        <Text style={styles.actionChipText}>
                          {actioningAddressId === address._id ? 'Working…' : 'Set default'}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => openEditAddress(address)}
                      disabled={actioningAddressId === address._id}
                      style={({ pressed }) => [
                        styles.actionChip,
                        pressed && styles.actionChipPressed,
                        actioningAddressId === address._id && styles.actionChipDisabled,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${address.label}`}
                      hitSlop={{ top: 9, bottom: 9, left: 4, right: 4 }}
                    >
                      <Text style={styles.actionChipText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDeleteAddress(address)}
                      disabled={actioningAddressId === address._id}
                      style={({ pressed }) => [
                        styles.actionChip,
                        styles.actionChipDanger,
                        pressed && styles.actionChipPressed,
                        actioningAddressId === address._id && styles.actionChipDisabled,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${address.label}`}
                      hitSlop={{ top: 9, bottom: 9, left: 4, right: 4 }}
                    >
                      <Text style={[styles.actionChipText, styles.actionChipDangerText]}>
                        {actioningAddressId === address._id ? 'Working…' : 'Delete'}
                      </Text>
                    </Pressable>
                  </View>
                </Card>
                );
              })
            )}

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Favorite shops</Text>
            {favorites.length === 0 ? (
              <Card muted style={styles.emptyAddressCard}>
                <Text style={styles.emptyTitle}>No favorites yet</Text>
                <Text style={styles.emptyHint}>
                  Tap the heart on a shop while booking to save it here.
                </Text>
              </Card>
            ) : (
              favorites.map((shop) => (
                <Card key={shop.branchId} style={styles.addressCard}>
                  <View style={styles.addressTop}>
                    {shop.logoUrl ? (
                      <Image
                        source={{ uri: resolveMediaUrl(shop.logoUrl) }}
                        style={styles.favoriteLogo}
                      />
                    ) : (
                      <View style={styles.favoriteLogoFallback}>
                        <Ionicons name="storefront-outline" size={18} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.addressMain}>
                      <Text style={styles.addressLabel}>{shop.name}</Text>
                      <Text style={styles.addressMeta}>
                        {shop.code} · {shop.city}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeFavorite(shop.branchId)}
                      disabled={actioningFavoriteId === shop.branchId}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${shop.name} from favorites`}
                    >
                      <Ionicons name="heart" size={22} color={colors.destructive} />
                    </Pressable>
                  </View>
                </Card>
              ))
            )}

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Help & account</Text>
            <Card muted style={styles.sectionCard}>
              <Pressable
                style={({ pressed }) => [styles.prefRow, pressed && styles.prefRowPressed]}
                onPress={() => router.push('/support' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Support tickets"
              >
                <Ionicons name="help-circle-outline" size={20} color={colors.secondary} />
                <View style={styles.prefCopy}>
                  <Text style={styles.prefTitle}>Support tickets</Text>
                  <Text style={styles.prefHint}>Track lost-item reports and complaints</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.prefRow, styles.prefRowBorder, pressed && styles.prefRowPressed]}
                onPress={() => router.push('/refunds' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Refund requests"
              >
                <Ionicons name="cash-outline" size={20} color={colors.accent} />
                <View style={styles.prefCopy}>
                  <Text style={styles.prefTitle}>Refund requests</Text>
                  <Text style={styles.prefHint}>View status from submission through payout</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.prefRow, styles.prefRowBorder, pressed && styles.prefRowPressed]}
                onPress={() => router.push('/subscriptions' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Recurring pickups"
              >
                <Ionicons name="repeat-outline" size={20} color={colors.primary} />
                <View style={styles.prefCopy}>
                  <Text style={styles.prefTitle}>Recurring pickups</Text>
                  <Text style={styles.prefHint}>Manage your subscribed pickup schedules</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.prefRow, styles.prefRowBorder, pressed && styles.prefRowPressed]}
                onPress={() => router.push('/scan-tag' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Scan my laundry tag"
              >
                <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
                <View style={styles.prefCopy}>
                  <Text style={styles.prefTitle}>Scan my laundry tag</Text>
                  <Text style={styles.prefHint}>Check which order a tag on your laundry belongs to</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.prefRow, styles.prefRowBorder, pressed && styles.prefRowPressed]}
                onPress={() => openUrl(privacyUrl)}
                accessibilityRole="button"
                accessibilityLabel="Privacy policy"
              >
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                <View style={styles.prefCopy}>
                  <Text style={styles.prefTitle}>Privacy policy</Text>
                  <Text style={styles.prefHint}>How we collect and use your data</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.prefRow, styles.prefRowBorder, pressed && styles.prefRowPressed]}
                onPress={() => openUrl(termsUrl)}
                accessibilityRole="button"
                accessibilityLabel="Terms of service"
              >
                <Ionicons name="reader-outline" size={20} color={colors.primary} />
                <View style={styles.prefCopy}>
                  <Text style={styles.prefTitle}>Terms of service</Text>
                  <Text style={styles.prefHint}>Rules for using {brandName}</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.prefRow, styles.prefRowBorder, pressed && styles.prefRowPressed]}
                onPress={confirmDeleteAccount}
                accessibilityRole="button"
                accessibilityLabel="Delete account"
              >
                <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                <View style={styles.prefCopy}>
                  <Text style={[styles.prefTitle, styles.destructiveText]}>Delete account</Text>
                  <Text style={styles.prefHint}>Request permanent removal of your account</Text>
                </View>
              </Pressable>
            </Card>

            <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Preferences</Text>
            <Card muted style={styles.sectionCard}>
              <Pressable
                style={({ pressed }) => [styles.prefRow, pressed && styles.prefRowPressed]}
                onPress={() => router.push('/notifications')}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                <View style={styles.prefCopy}>
                  <Text style={styles.prefTitle}>Notifications</Text>
                  <Text style={styles.prefHint}>
                    Order updates, review requests, and refund alerts
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Pressable>
              <View style={[styles.prefRow, styles.prefRowBorder]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.secondary} />
                <View style={styles.prefCopy}>
                  <Text style={styles.prefTitle}>Secure payments</Text>
                  <Text style={styles.prefHint}>
                    Pay with GCash, card, cash, or your {brandName} wallet at checkout
                  </Text>
                </View>
              </View>
            </Card>

            <ShareInviteCard
              payload={buildAppSharePayload(getShareWebsiteUrl(), brandName)}
              title="Invite friends"
              description={`Share ${brandName} on WhatsApp, Facebook, or X so friends can book laundry too.`}
            />

            <Button label="Sign out" variant="outline" onPress={handleLogout} style={styles.logoutBtn} />
          </>
        ) : null}
      </KeyboardSafeScrollView>

      <AddressFormModal
        visible={addressModalOpen}
        editing={editingAddress}
        hasAddresses={addresses.length > 0}
        saving={addressSaving}
        onClose={() => setAddressModalOpen(false)}
        onSave={saveAddress}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  heroCard: { alignItems: 'center', paddingVertical: spacing.xxl, marginBottom: spacing.lg },
  heroName: { ...typography.subheading },
  heroMeta: { ...typography.caption, marginTop: spacing.xs },
  sectionTitle: { ...typography.subheading, fontSize: 16, marginBottom: spacing.sm },
  sectionTitleSpaced: { marginTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addLinkText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  linkPressed: { opacity: 0.7 },
  sectionCard: { marginBottom: spacing.lg, gap: spacing.sm },
  fieldLabel: { ...typography.label, marginBottom: -spacing.xs },
  fieldLabelSpaced: { marginTop: spacing.sm },
  sectionBtn: { marginTop: spacing.sm },
  inlineError: { color: colors.destructive, fontSize: 13 },
  inlineSuccess: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  emptyAddressCard: { alignItems: 'center', marginBottom: spacing.lg, paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.body, fontWeight: '600' },
  emptyHint: { ...typography.caption, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
  addressCard: { marginBottom: spacing.sm },
  businessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  businessRowLabel: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  businessRowMeta: { fontSize: 12, color: colors.muted },
  favoriteLogo: { width: 36, height: 36, borderRadius: radius.md, marginRight: spacing.sm },
  favoriteLogoFallback: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  addressTop: { flexDirection: 'row' },
  addressMain: { flex: 1 },
  addressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  addressLabel: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  defaultBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primaryDark },
  typeBadge: {
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: colors.secondaryDark },
  addressLine: { fontSize: 14, color: colors.slate700, marginTop: spacing.xs },
  addressMeta: { ...typography.caption, marginTop: spacing.xs },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm - 2 },
  gpsText: { fontSize: 11, fontWeight: '600', color: colors.accentDark },
  mapsLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm - 2 },
  mapsLinkText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  addressActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionChipText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  actionChipDanger: { borderColor: colors.destructive + '33' },
  actionChipDangerText: { color: colors.destructive },
  actionChipPressed: { opacity: 0.85 },
  actionChipDisabled: { opacity: 0.5 },
  prefRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  prefRowPressed: { opacity: 0.85 },
  prefRowBorder: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.md },
  prefCopy: { flex: 1 },
  prefTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  destructiveText: { color: colors.destructive },
  prefHint: { ...typography.caption, marginTop: spacing.xs },
  logoutBtn: { marginTop: spacing.xxxl },
});
