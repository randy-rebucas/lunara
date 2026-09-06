import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type { Dispatch, SetStateAction } from 'react';
import { AddressType } from '@lunara/types';
import { formatAddressTypeLabel } from '@lunara/utils';
import { colors } from '../../theme';
import type { BookingFormState } from '../../lib/booking-flow';
import { StepHeading, addressHasCoords, styles, type AddressOption } from './shared';

interface AddressStepProps {
  form: BookingFormState;
  setForm: Dispatch<SetStateAction<BookingFormState>>;
  addresses: AddressOption[];
  addressesError: string;
  dispatchNote: string;
  onAddAddress: () => void;
}

/** Step 1 of the booking flow — pickup address selection. Extracted verbatim from `app/book.tsx`;
 * all business logic (validation, API calls) stays in the orchestrator, this only owns rendering. */
export function AddressStep({
  form,
  setForm,
  addresses,
  addressesError,
  dispatchNote,
  onAddAddress,
}: AddressStepProps) {
  return (
    <View>
      <StepHeading step="address" title="Pickup address" />
      {addressesError ? <Text style={styles.error}>{addressesError}</Text> : null}
      {dispatchNote ? (
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={16} color={colors.primary} />
          <Text style={styles.infoText}>{dispatchNote}</Text>
        </View>
      ) : null}
      {addresses.length === 0 ? (
        <Pressable
          style={({ pressed }) => [
            styles.shopCard,
            styles.autoDispatchCard,
            pressed && styles.shopCardPressed,
          ]}
          onPress={onAddAddress}
          accessibilityRole="button"
          accessibilityLabel="Add address in Profile"
        >
          <View style={styles.shopHeaderRow}>
            <View style={styles.shopTitleGroup}>
              <View style={styles.autoDispatchIcon}>
                <Ionicons name="add" size={20} color={colors.primary} />
              </View>
              <View style={styles.shopTitleTextGroup}>
                <Text style={styles.shopName}>Add address in Profile</Text>
                <Text style={styles.shopMetaText}>
                  Save a pickup address with GPS so riders can navigate to you
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </View>
        </Pressable>
      ) : (
        addresses.map((a) => {
          const selected = form.addressId === a._id;
          const hasCoords = addressHasCoords(a);
          const addressIcon =
            a.addressType === AddressType.WORK
              ? 'briefcase-outline'
              : a.addressType === AddressType.APARTMENT
                ? 'business-outline'
                : a.addressType === AddressType.OTHER
                  ? 'location-outline'
                  : 'home-outline';
          return (
            <Pressable
              key={a._id}
              style={({ pressed }) => [
                styles.shopCard,
                selected && styles.shopCardSelected,
                !hasCoords && styles.shopCardDisabled,
                pressed && styles.shopCardPressed,
              ]}
              onPress={() =>
                setForm((f) => ({
                  ...f,
                  addressId: a._id,
                  branchId: '',
                  autoDispatch: false,
                  scheduledPickupAt: '',
                }))
              }
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={styles.shopHeaderRow}>
                <View style={styles.shopTitleGroup}>
                  <View style={styles.shopLogoFallback}>
                    <Ionicons name={addressIcon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.shopTitleTextGroup}>
                    <View style={styles.addressLabelRow}>
                      <Text style={styles.shopName} numberOfLines={1}>
                        {a.label}
                      </Text>
                      {a.isDefault ? (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.shopMetaText} numberOfLines={2}>
                      {formatAddressTypeLabel(a.addressType)} · {a.line1}, {a.city}
                    </Text>
                  </View>
                </View>
                {selected ? (
                  <View style={styles.shopCheckBadge}>
                    <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                  </View>
                ) : null}
              </View>
              {hasCoords ? (
                <View style={[styles.statusPill, styles.statusPillOpen]}>
                  <Ionicons name="navigate" size={12} color={colors.accentDark} />
                  <Text style={[styles.statusPillText, styles.statusPillTextOpen]}>
                    GPS pinned for rider navigation
                  </Text>
                </View>
              ) : (
                <View style={styles.warnPill}>
                  <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                  <Text style={styles.warnPillText}>No GPS pin — update in Profile before booking</Text>
                </View>
              )}
            </Pressable>
          );
        })
      )}
    </View>
  );
}
