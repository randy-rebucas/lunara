import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';
import type { BookingType } from '@lunara/types';
import {
  formatCurrency,
  isGarmentPricedBookingType,
  BranchPricingMode,
  type BagSizeOption,
  type BookingAddonOption,
  type BranchHoliday,
  type GarmentItem,
  type GarmentSelection,
  type LaundryServiceOption,
} from '@lunara/utils';
import { colors, radius, shadow, spacing, typography } from '../../theme';
import type { BookingFormState, BookingStep } from '../../lib/booking-flow';

/** Shared types, constants, styles, and small presentational helpers for the multi-step booking
 * flow (`app/book.tsx` + `src/components/book/*-step.tsx`). Pulled into one module so every step
 * component can reference the exact same `styles` object the orchestrator originally used inline
 * — this is a pure extraction, no visual or behavioral change. */

export interface ReorderSourceOrder {
  _id: string;
  branchId?: string;
  bookingType: BookingType;
  bagSizeId?: string;
  addons?: { id: string; quantity?: number }[];
  pickupAddressId?: string;
}

export interface AddressOption {
  _id: string;
  label: string;
  addressType?: string;
  line1: string;
  city: string;
  province: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export function addressHasCoords(address?: AddressOption | null) {
  return address?.latitude != null && address?.longitude != null;
}

export interface BookingConfig {
  services: LaundryServiceOption[];
  addons: BookingAddonOption[];
  minOrderAmount: number;
  bagSizes: BagSizeOption[];
}

export interface ShopServiceOption {
  type: BookingType;
  label: string;
  description?: string;
  basePricePerKg: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  basePricePerPair?: number;
  basePricePerItem?: number;
  fixedPrice?: number;
  pricingUnit?: BranchPricingMode;
  customerPricePerKg: number;
  customerPricePerLoad?: number;
  customerPricePerPiece?: number;
  customerPricePerPair?: number;
  customerPricePerItem?: number;
  customerFixedPrice?: number;
  isCustom?: boolean;
  customServiceId?: string;
}

export interface ShopAddonOption {
  slug: string;
  label: string;
  description?: string;
  basePrice: number;
  customerPrice: number;
  pricingUnit?: BranchPricingMode;
  isPercentOfService?: boolean;
  isCustom?: boolean;
  customAddonId?: string;
  applicableServiceTypes?: string[];
  allowsQuantity?: boolean;
  maxQuantity?: number;
  /** Units of this add-on bundled free into the service by the shop — only the customer's
   * quantity beyond this is billed. */
  includedQuantity?: number;
}

/** Every other branch in the same partner's group carries the same full shape as the group's
 * headline shop (pricing, schedule, withinRadius, capacity) — see findNearbyShopsWithPricing. */
export type ShopBranchVariant = Omit<ShopOption, 'mainShopId' | 'branches'>;

export interface ShopOption {
  branchId: string;
  partnerUserId: string;
  mainShopId: string;
  isMainShop: boolean;
  code: string;
  name: string;
  city: string;
  distanceKm: number;
  distanceLabel: string;
  withinRadius: boolean;
  /** Platform-wide delivery ceiling (default 15km) — beyond this, checkout always rejects the
   * order regardless of branch, so this must gate selectability, not just styling. */
  withinMaxDeliveryRadius: boolean;
  capacityAvailable: boolean;
  logoUrl?: string;
  pricingMode: BranchPricingMode;
  kgPerLoad?: number;
  operatingHours: { isClosed: boolean; openTime: string; closeTime: string }[];
  holidays: BranchHoliday[];
  services: ShopServiceOption[];
  addons: ShopAddonOption[];
  branches: ShopBranchVariant[];
  /** GARMENT_CATALOG filtered to what this shop offers — falls back to the full catalog if absent. */
  garmentCatalog?: GarmentItem[];
}

export const STEP_ICON: Record<BookingStep, keyof typeof Ionicons.glyphMap> = {
  service: 'shirt-outline',
  address: 'location-outline',
  shop: 'storefront-outline',
  schedule: 'calendar-outline',
  weight: 'scale-outline',
  addons: 'sparkles-outline',
  review: 'receipt-outline',
  confirm: 'checkmark-circle-outline',
};

export const ADDON_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  fabric_softener: 'water-outline',
  stain_treatment: 'color-wand-outline',
  eco_wash: 'leaf-outline',
  express_delivery: 'flash-outline',
};
export const ADDON_ICON_FALLBACK: keyof typeof Ionicons.glyphMap = 'pricetag-outline';

/** Non-empty garmentSelections payload for garment-priced booking types, else undefined. */
export function buildGarmentSelectionsPayload(form: BookingFormState): GarmentSelection[] | undefined {
  if (!form.bookingType || !isGarmentPricedBookingType(form.bookingType)) return undefined;
  const selections = Object.entries(form.garmentQuantities)
    .map(([garmentId, qty]) => ({ garmentId, quantity: Number(qty) || 0 }))
    .filter((sel) => sel.quantity > 0);
  return selections.length > 0 ? selections : undefined;
}

// Services on the same shop can each bill in a different unit, so "cheapest" is computed
// per-service in its own unit, not one shop-wide unit.
export function startingPriceLabelFor(
  shop: Pick<ShopOption, 'services'>,
  flatBagFrom: number | undefined,
): string | null {
  const candidates = shop.services
    .map((s) => {
      const unit = s.pricingUnit ?? BranchPricingMode.FLAT_BAG;
      if (unit === BranchPricingMode.PER_LOAD && s.customerPricePerLoad != null) {
        return { amount: s.customerPricePerLoad, suffix: ' / load' };
      }
      if (unit === BranchPricingMode.PER_PIECE && s.customerPricePerPiece != null) {
        return { amount: s.customerPricePerPiece, suffix: ' / piece' };
      }
      if (unit === BranchPricingMode.PER_PAIR && s.customerPricePerPair != null) {
        return { amount: s.customerPricePerPair, suffix: ' / pair' };
      }
      if (unit === BranchPricingMode.PER_ITEM && s.customerPricePerItem != null) {
        return { amount: s.customerPricePerItem, suffix: ' / item' };
      }
      if (unit === BranchPricingMode.FIXED && s.customerFixedPrice != null) {
        return { amount: s.customerFixedPrice, suffix: '' };
      }
      if (unit === BranchPricingMode.FLAT_BAG && flatBagFrom != null) {
        return { amount: flatBagFrom, suffix: '' };
      }
      if (unit === BranchPricingMode.PER_KG) {
        return { amount: s.customerPricePerKg, suffix: ' / kg' };
      }
      return null;
    })
    .filter((c): c is { amount: number; suffix: string } => c != null);
  const cheapest = candidates.reduce<{ amount: number; suffix: string } | null>(
    (min, c) => (!min || c.amount < min.amount ? c : min),
    null,
  );
  return cheapest ? `From ${formatCurrency(cheapest.amount)}${cheapest.suffix}` : null;
}

export function StepHeading({ step, title }: { step: BookingStep; title: string }) {
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingIcon}>
        <Ionicons name={STEP_ICON[step]} size={16} color={colors.primary} />
      </View>
      <Text style={styles.heading}>{title}</Text>
    </View>
  );
}

/** Drag-to-estimate weight slider for the PER_KG/PER_LOAD detail steps — replaces the numeric
 * keyboard entry. Caps the visible track at maxKg, but a value already above it (e.g. from a
 * previous larger estimate) still displays correctly, just pinned at the far end of the track. */
export function WeightSlider({
  value,
  maxKg,
  onChange,
}: {
  value: string;
  maxKg: number;
  onChange: (raw: string) => void;
}) {
  const weight = Number(value) || 0;
  return (
    <View>
      <Slider
        minimumValue={0}
        maximumValue={maxKg}
        step={0.5}
        value={Math.min(weight, maxKg)}
        onValueChange={(v) => onChange(v > 0 ? String(v) : '')}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
        style={styles.weightSlider}
      />
      <View style={styles.weightSliderLabels}>
        <Text style={styles.weightSliderLabelText}>0 kg</Text>
        <Text style={styles.weightSliderLabelText}>
          {weight > maxKg ? `${weight} kg` : `${maxKg}+ kg`}
        </Text>
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  scroll: { flex: 1 },
  content: { padding: spacing.xl },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  headingIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { ...typography.heading },
  sub: { ...typography.bodySm, marginBottom: spacing.md },
  error: { color: colors.destructive, marginBottom: spacing.md },
  errorBlock: { marginBottom: spacing.md, gap: spacing.sm },
  retryBtn: { alignSelf: 'flex-start' },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg - 2,
    marginBottom: spacing.md - 2,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionDisabled: { opacity: 0.4 },
  optionPressed: { opacity: 0.9 },
  optionTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionTopRowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  optionCheck: { marginLeft: 'auto' },
  shopLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shopLogoFallback: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  shopCardSelected: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: colors.primaryLight,
    ...shadow.elevated,
  },
  shopCardFar: { opacity: 0.55 },
  shopCardDisabled: { opacity: 0.45 },
  shopCardPressed: { opacity: 0.92 },
  autoDispatchCard: { borderStyle: 'dashed' },
  autoDispatchIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  shopTitleGroup: { flexDirection: 'row', gap: spacing.md, flexShrink: 1, flex: 1 },
  shopTitleTextGroup: { flexShrink: 1, gap: 3, paddingTop: 1 },
  shopActionsGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.sm },
  shopFavBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  shopCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: { fontWeight: '700', fontSize: 16, color: colors.foreground },
  shopMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shopMetaText: { fontSize: 12.5, color: colors.muted, flexShrink: 1 },
  shopStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  statusPillOpen: { backgroundColor: colors.accentLight },
  statusPillClosed: { backgroundColor: colors.surfaceMuted },
  statusDot: { width: 6, height: 6, borderRadius: radius.full },
  statusDotOpen: { backgroundColor: colors.accentDark },
  statusDotClosed: { backgroundColor: colors.mutedForeground },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  statusPillTextOpen: { color: colors.accentDark },
  statusPillTextClosed: { color: colors.mutedForeground },
  shopPriceTag: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  branchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  branchChipText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  warnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.warningBg,
  },
  warnPillText: { fontSize: 12, fontWeight: '600', color: colors.warning },
  optionTitle: { fontWeight: '600', fontSize: 16, color: colors.foreground },
  optionBadge: { fontWeight: '600', fontSize: 12, color: colors.accentDark },
  optionSub: { marginTop: spacing.xs, fontSize: 13, color: colors.muted },
  optionPrice: { marginTop: spacing.sm - 2, fontSize: 13, color: colors.primary, fontWeight: '500' },
  optionGpsMissing: { marginTop: spacing.sm - 2, fontSize: 12, color: colors.warning, fontWeight: '500' },
  addonIncludedBadge: { marginTop: spacing.xs, fontSize: 12, color: colors.accentDark, fontWeight: '500' },
  addressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  defaultBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primaryDark },
  addonCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  addonCardBody: { flex: 1, minWidth: 0 },
  addonImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addonRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addonPrice: { fontSize: 15, fontWeight: '600', color: colors.primary },
  loadInfo: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '26',
    backgroundColor: colors.primary + '0D',
    gap: spacing.sm,
  },
  loadInfoText: { fontSize: 13, lineHeight: 20, color: colors.muted },
  loadInfoHighlight: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  weightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.lg,
  },
  weightService: { fontSize: 13, color: colors.muted },
  weightRange: { textAlign: 'center', fontSize: 12, color: colors.mutedForeground, marginTop: spacing.sm },
  promoCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  promoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  promoTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  promoInputRow: { flexDirection: 'row', gap: spacing.sm },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
    color: colors.foreground,
    backgroundColor: colors.surfaceMuted,
  },
  weightInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  weightCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.card,
  },
  weightIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  weightCardDesc: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.muted },
  weightInputRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  weightInputLarge: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.foreground,
    backgroundColor: colors.surfaceMuted,
  },
  weightUnitChip: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  weightUnitChipText: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  weightReadoutRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  weightReadoutValue: { fontSize: 40, fontWeight: '700', color: colors.foreground },
  weightReadoutUnit: { fontSize: 16, fontWeight: '600', color: colors.muted },
  weightSlider: { width: '100%', height: 36, marginTop: spacing.xs },
  weightSliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -spacing.xs },
  weightSliderLabelText: { fontSize: 12, color: colors.mutedForeground },
  weightHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  weightHintPillText: { fontSize: 12, fontWeight: '500', color: colors.muted },
  weightPriceTag: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  promoApplyBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  promoApplyText: { color: colors.onPrimary, fontWeight: '600', fontSize: 14 },
  promoAppliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  promoAppliedText: { flex: 1 },
  promoAppliedCode: { fontSize: 15, fontWeight: '700', color: colors.primary },
  promoAppliedSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  promoRemove: { fontSize: 13, fontWeight: '600', color: colors.primary },
  estimateCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow.card,
  },
  estimateBody: { padding: spacing.lg, paddingBottom: spacing.xs },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  estimateLineIconRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, paddingRight: spacing.sm },
  estimateServiceIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estimateLabel: { fontSize: 14, fontWeight: '600', flex: 1, color: colors.foreground },
  estimateLabelMuted: { fontSize: 13.5, color: colors.muted, flex: 1 },
  estimateAmount: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  estimateAmountMuted: { fontSize: 13.5, color: colors.muted },
  estimateBreakdownNote: { fontSize: 11.5, color: colors.mutedForeground },
  estimateDiscountLabel: { fontSize: 14, flex: 1, paddingRight: spacing.sm, color: colors.accentDark },
  estimateDiscountAmount: { fontSize: 14, fontWeight: '600', color: colors.accentDark },
  estimateDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md - 2,
    marginTop: spacing.xs,
  },
  estimateFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  estimateTotalLabel: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  estimateTotal: { fontSize: 18, fontWeight: '700', color: colors.primaryDark },
  estimateNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  estimateNote: { fontSize: 12, color: colors.mutedForeground, flex: 1 },
  summaryCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg - 2,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryLine: { fontSize: 14, color: colors.slate800 },
  summaryMuted: { color: colors.muted },
  summaryTotal: { fontWeight: '700' },
  summaryShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryShopTextGroup: { flexShrink: 1, gap: 2 },
  summaryShopName: { fontSize: 15, fontWeight: '700', color: colors.foreground },
  shopContextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  confirmNote: { ...typography.caption, lineHeight: 18, marginBottom: spacing.md },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoText: { flex: 1, fontSize: 13, color: colors.slate700, lineHeight: 20 },
  weightValue: { fontSize: 32, fontWeight: '700', color: colors.primary },
  weightRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xxxl, marginBottom: spacing.lg },
  weightBtnCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightBtnPressed: { opacity: 0.8 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl },
  secondaryBtn: { flex: 1 },
  primaryBtn: { flex: 2 },
  btnDisabled: { opacity: 0.6 },
  linkPressed: { opacity: 0.7 },
  garmentCategoryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  garmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  garmentRowFirst: { borderTopWidth: 0 },
  garmentQtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  garmentQtyBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentQtyValue: { minWidth: 24, textAlign: 'center', fontWeight: '600', fontSize: 15 },
});
