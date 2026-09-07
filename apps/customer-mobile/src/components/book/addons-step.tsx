import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Dispatch, SetStateAction } from 'react';
import {
  BranchPricingMode,
  EXPRESS_RETURN_ADDON_ID,
  formatCurrency,
  type BookingAddonOption,
} from '@lunara/utils';
import { colors, spacing } from '../../theme';
import type { BookingFormState } from '../../lib/booking-flow';
import { ADDON_ICONS, ADDON_ICON_FALLBACK, StepHeading, styles } from './shared';

type AddonOption = BookingAddonOption & {
  pricingUnit: BranchPricingMode;
  isPercentOfService?: boolean;
  allowsQuantity?: boolean;
  maxQuantity?: number;
  includedQuantity?: number;
};

interface AddonsStepProps {
  form: BookingFormState;
  setForm: Dispatch<SetStateAction<BookingFormState>>;
  addons: AddonOption[];
  expressReturnAllowed: boolean;
  shopPricingMode: BranchPricingMode;
}

/** Step "addons" of the booking flow — optional add-on selection, including quantity steppers for
 * add-ons the shop allows sizing and the shared piece-count input for per-piece/pair/item add-ons.
 * Extracted verbatim from `app/book.tsx`. */
export function AddonsStep({ form, setForm, addons, expressReturnAllowed, shopPricingMode }: AddonsStepProps) {
  return (
    <View>
      <StepHeading step="addons" title="Add-ons (optional)" />
      {addons.length === 0 ? (
        <Text style={styles.sub}>No add-ons available.</Text>
      ) : (
        addons.map((a) => {
          const selected = form.addonIds.includes(a.id);
          const isExpressReturn = a.id === EXPRESS_RETURN_ADDON_ID;
          const disabled = isExpressReturn && !expressReturnAllowed;
          const unitSuffix =
            a.pricingUnit === BranchPricingMode.PER_KG
              ? ' / kg'
              : a.pricingUnit === BranchPricingMode.PER_LOAD
                ? ' / load'
                : a.pricingUnit === BranchPricingMode.PER_PIECE
                  ? ' / piece'
                  : a.pricingUnit === BranchPricingMode.PER_PAIR
                    ? ' / pair'
                    : a.pricingUnit === BranchPricingMode.PER_ITEM
                      ? ' / item'
                      : '';
          // Default to whatever's already bundled free, so the stepper starts where the
          // customer's included units end rather than at a flat 1.
          const defaultQuantity = Math.max(1, a.includedQuantity ?? 0);
          const quantity = form.addonQuantities[a.id] ?? defaultQuantity;
          const maxQuantity = a.maxQuantity ?? 5;

          const cardBody = (
            <View style={styles.addonCardRow}>
              <View style={styles.addonImagePlaceholder}>
                <Ionicons name={ADDON_ICONS[a.id] ?? ADDON_ICON_FALLBACK} size={22} color={colors.primary} />
              </View>
              <View style={styles.addonCardBody}>
                <View style={styles.addonRow}>
                  <Text style={styles.optionTitle}>{a.label}</Text>
                  <View style={styles.addonRight}>
                    <Text style={styles.addonPrice}>
                      {a.isPercentOfService ? `+${a.price}%` : `+${formatCurrency(a.price)}${unitSuffix}`}
                    </Text>
                    {selected && !a.allowsQuantity ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    ) : null}
                  </View>
                </View>
                <Text style={styles.optionSub}>{a.description}</Text>
                {!a.isPercentOfService && !a.allowsQuantity ? (
                  <Text style={styles.addonIncludedBadge}>Included with your service</Text>
                ) : null}
                {!a.isPercentOfService && a.allowsQuantity && (a.includedQuantity ?? 0) > 0 ? (
                  <Text style={styles.addonIncludedBadge}>
                    First {a.includedQuantity} included free — add more for {formatCurrency(a.price)}
                    {unitSuffix} each
                  </Text>
                ) : null}
                {!a.isPercentOfService && a.allowsQuantity && !(a.includedQuantity ?? 0) ? (
                  <Text style={styles.addonIncludedBadge}>
                    Pre-added by this shop — set the quantity or remove it
                  </Text>
                ) : null}
                {disabled ? (
                  <Text style={styles.optionGpsMissing}>Not available for pickups at 3:00 PM or later</Text>
                ) : null}
              </View>
            </View>
          );

          if (a.allowsQuantity && selected) {
            return (
              <View key={a.id} style={[styles.option, styles.optionSelected]}>
                {cardBody}
                <View style={[styles.garmentQtyRow, { justifyContent: 'flex-end', marginTop: spacing.sm }]}>
                  <Pressable
                    style={styles.garmentQtyBtn}
                    onPress={() =>
                      setForm((f) => {
                        const next = quantity - 1;
                        if (next <= 0) {
                          return { ...f, addonIds: f.addonIds.filter((id) => id !== a.id) };
                        }
                        return { ...f, addonQuantities: { ...f.addonQuantities, [a.id]: next } };
                      })
                    }
                  >
                    <Ionicons name="remove" size={16} color={colors.foreground} />
                  </Pressable>
                  <Text style={styles.garmentQtyValue}>{quantity}</Text>
                  <Pressable
                    style={styles.garmentQtyBtn}
                    disabled={quantity >= maxQuantity}
                    onPress={() =>
                      setForm((f) => ({
                        ...f,
                        addonQuantities: { ...f.addonQuantities, [a.id]: Math.min(quantity + 1, maxQuantity) },
                      }))
                    }
                  >
                    <Ionicons name="add" size={16} color={colors.foreground} />
                  </Pressable>
                </View>
              </View>
            );
          }

          return (
            <Pressable
              key={a.id}
              disabled={disabled}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                disabled && styles.optionDisabled,
                pressed && !disabled && styles.optionPressed,
              ]}
              onPress={() =>
                setForm((f) => ({
                  ...f,
                  addonIds: selected ? f.addonIds.filter((id) => id !== a.id) : [...f.addonIds, a.id],
                  addonQuantities:
                    a.allowsQuantity && !selected
                      ? { ...f.addonQuantities, [a.id]: Math.max(1, a.includedQuantity ?? 0) }
                      : f.addonQuantities,
                }))
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
            >
              {cardBody}
            </Pressable>
          );
        })
      )}
      {shopPricingMode !== BranchPricingMode.PER_PIECE &&
      shopPricingMode !== BranchPricingMode.PER_PAIR &&
      shopPricingMode !== BranchPricingMode.PER_ITEM &&
      form.addonIds.some((id) => {
        const addon = addons.find((a) => a.id === id);
        // An add-on with its own quantity stepper bills from that stepper, not the
        // order's piece count — see combineServiceQuotes in packages/utils/src/booking.ts.
        if (addon?.allowsQuantity) return false;
        const unit = addon?.pricingUnit;
        return (
          unit === BranchPricingMode.PER_PIECE ||
          unit === BranchPricingMode.PER_PAIR ||
          unit === BranchPricingMode.PER_ITEM
        );
      }) ? (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.optionSub}>Piece count (for the per-piece add-on above)</Text>
          <TextInput
            style={styles.weightInput}
            keyboardType="number-pad"
            placeholder="e.g. 4"
            value={form.enteredPieceCount}
            onChangeText={(v) => setForm((f) => ({ ...f, enteredPieceCount: v }))}
          />
        </View>
      ) : null}
    </View>
  );
}
