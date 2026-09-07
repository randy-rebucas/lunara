import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Dispatch, SetStateAction } from 'react';
import { BranchPricingMode, formatCurrency, type BookingAddonOption, type QuoteBreakdown } from '@lunara/utils';
import { colors, spacing } from '../../theme';
import type { BookingFormState } from '../../lib/booking-flow';
import { ADDON_ICONS, ADDON_ICON_FALLBACK, StepHeading, styles } from './shared';

interface ReviewStepProps {
  form: BookingFormState;
  setForm: Dispatch<SetStateAction<BookingFormState>>;
  activeQuote: QuoteBreakdown;
  addons: (BookingAddonOption & { allowsQuantity?: boolean })[];
  promoLoading: boolean;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
}

/** Step "review" of the booking flow — price estimate + promo code entry. Extracted verbatim
 * from `app/book.tsx`; the actual promo/quote API calls stay in the orchestrator. */
export function ReviewStep({
  form,
  setForm,
  activeQuote,
  addons,
  promoLoading,
  onApplyPromo,
  onRemovePromo,
}: ReviewStepProps) {
  return (
    <View>
      <StepHeading step="review" title="Price estimate" />
      <View style={styles.promoCard}>
        <View style={styles.promoTitleRow}>
          <Ionicons name="pricetag-outline" size={15} color={colors.mutedForeground} />
          <Text style={styles.promoTitle}>Promo code</Text>
        </View>
        {activeQuote.couponCode ? (
          <View style={styles.promoAppliedRow}>
            <View style={styles.promoAppliedText}>
              <Text style={styles.promoAppliedCode}>{activeQuote.couponCode}</Text>
              {activeQuote.promotionTitle ? (
                <Text style={styles.promoAppliedSub}>{activeQuote.promotionTitle}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={onRemovePromo}
              disabled={promoLoading}
              style={({ pressed }) => pressed && styles.linkPressed}
              accessibilityRole="button"
              accessibilityLabel="Remove promo code"
              hitSlop={6}
            >
              <Text style={styles.promoRemove}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.promoInputRow}>
            <TextInput
              value={form.couponCode}
              onChangeText={(text) => setForm((f) => ({ ...f, couponCode: text.toUpperCase() }))}
              placeholder="e.g. WELCOME10"
              autoCapitalize="characters"
              style={styles.promoInput}
            />
            <Pressable
              style={[styles.promoApplyBtn, (!form.couponCode.trim() || promoLoading) && styles.btnDisabled]}
              onPress={onApplyPromo}
              disabled={!form.couponCode.trim() || promoLoading}
            >
              <Text style={styles.promoApplyText}>Apply</Text>
            </Pressable>
          </View>
        )}
      </View>
      <View style={styles.estimateCard}>
        <View style={styles.estimateBody}>
          <View style={styles.estimateRow}>
            <View style={styles.estimateLineIconRow}>
              <View style={styles.estimateServiceIcon}>
                <Ionicons name="shirt-outline" size={14} color={colors.primary} />
              </View>
              <Text style={styles.estimateLabel}>
                {activeQuote.pricingMode === BranchPricingMode.FLAT_BAG
                  ? `${activeQuote.serviceLabel} — ${activeQuote.bagLabel} bag`
                  : activeQuote.serviceLabel}
              </Text>
            </View>
            <Text style={styles.estimateAmount}>{formatCurrency(activeQuote.serviceSubtotal)}</Text>
          </View>
          {activeQuote.addons.map((a) => {
            // For an add-on the customer can size (allowsQuantity), the label must reflect
            // what's actually billed (a.billedQuantity = addonQuantity minus whatever the
            // shop already bundles free) — a.quantity is the order's own weight/load/piece
            // count, which only doubles as the billed amount when the add-on always applies
            // to the whole order (no customer-chosen quantity, nothing bundled).
            const addonOption = addons.find((opt) => opt.id === a.id);
            const isPerUnitCounted =
              a.unit === BranchPricingMode.PER_PIECE ||
              a.unit === BranchPricingMode.PER_PAIR ||
              a.unit === BranchPricingMode.PER_ITEM;
            // Show the quantity the customer actually picked (addonQuantity), not just what's
            // billed — a bundle-covered pick (billedQuantity 0) still reflects their choice
            // here, with the $0 price line below making clear it's free. For a per-piece/pair/
            // item add-on the shop bundles in without a customer stepper, `quantity` is the
            // order's own piece count — 0 for a per-kg/per-load service — so fall back to the
            // partner-configured includedQuantity to show what's actually bundled in.
            const displayQty =
              addonOption?.allowsQuantity && isPerUnitCounted
                ? a.addonQuantity
                : isPerUnitCounted && !a.quantity && (a.includedQuantity ?? 0) > 0
                  ? a.includedQuantity
                  : a.quantity;
            const detail = a.percent
              ? `${a.label} (+${a.percent}%)`
              : a.unit === BranchPricingMode.PER_KG
                ? `${a.label} (${displayQty ?? 0} kg)`
                : a.unit === BranchPricingMode.PER_LOAD
                  ? `${a.label} (×${displayQty ?? 0} load${displayQty === 1 ? '' : 's'})`
                  : a.unit === BranchPricingMode.PER_PIECE
                    ? `${a.label} (×${displayQty ?? 0} piece${displayQty === 1 ? '' : 's'})`
                    : a.unit === BranchPricingMode.PER_PAIR
                      ? `${a.label} (×${displayQty ?? 0} pair${displayQty === 1 ? '' : 's'})`
                      : a.unit === BranchPricingMode.PER_ITEM
                        ? `${a.label} (×${displayQty ?? 0} item${displayQty === 1 ? '' : 's'})`
                        : addonOption?.allowsQuantity && (a.addonQuantity ?? 1) > 1
                          ? `${a.label} (×${a.addonQuantity})`
                          : a.label;
            return (
              <View key={a.id} style={styles.estimateRow}>
                <View style={styles.estimateLineIconRow}>
                  <Ionicons name={ADDON_ICONS[a.id] ?? ADDON_ICON_FALLBACK} size={13} color={colors.mutedForeground} />
                  <Text style={styles.estimateLabelMuted}>{detail}</Text>
                </View>
                <Text style={styles.estimateAmountMuted}>{a.price > 0 ? formatCurrency(a.price) : 'Free'}</Text>
              </View>
            );
          })}
          {activeQuote.deliveryDistanceKm != null &&
          activeQuote.deliveryBaseDistanceKm != null &&
          activeQuote.deliveryPerKmRate != null
            ? (() => {
                const chargeableKm = Math.max(
                  0,
                  Math.ceil(activeQuote.deliveryDistanceKm - activeQuote.deliveryBaseDistanceKm),
                );
                if (chargeableKm <= 0) return null;
                const extraDistanceFee = chargeableKm * activeQuote.deliveryPerKmRate;
                return (
                  <>
                    <View style={[styles.estimateRow, styles.estimateDivider, { marginBottom: 0 }]}>
                      <Text style={styles.estimateLabel}>Additional distance charge</Text>
                      <Text style={styles.estimateAmount}>{formatCurrency(extraDistanceFee)}</Text>
                    </View>
                    <Text style={[styles.estimateBreakdownNote, { marginBottom: spacing.sm }]}>
                      {activeQuote.deliveryDistanceKm.toFixed(1)} km to shop ·{' '}
                      {formatCurrency(activeQuote.deliveryPerKmRate)}/km beyond {activeQuote.deliveryBaseDistanceKm}{' '}
                      km × {chargeableKm} km
                    </Text>
                  </>
                );
              })()
            : null}
          {activeQuote.discount > 0 && (
            <View style={styles.estimateRow}>
              <Text style={styles.estimateDiscountLabel}>
                Discount{activeQuote.promotionTitle ? ` — ${activeQuote.promotionTitle}` : ''}
              </Text>
              <Text style={styles.estimateDiscountAmount}>−{formatCurrency(activeQuote.discount)}</Text>
            </View>
          )}
        </View>
        <View style={styles.estimateFooter}>
          <Text style={styles.estimateTotalLabel}>Estimated total</Text>
          <Text style={styles.estimateTotal}>{formatCurrency(activeQuote.total)}</Text>
        </View>
      </View>
      <View style={styles.estimateNoteRow}>
        <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} />
        <Text style={styles.estimateNote}>Final amount may adjust after weigh-in.</Text>
      </View>
      {!activeQuote.meetsMinimum && (
        <Text style={styles.error}>Below minimum order of {formatCurrency(activeQuote.minimumOrderAmount)}.</Text>
      )}
    </View>
  );
}
