import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';
import type { Dispatch, SetStateAction } from 'react';
import type { BookingType } from '@lunara/types';
import { BranchPricingMode, formatCurrency } from '@lunara/utils';
import { resolveMediaUrl } from '../../lib/media-url';
import { brandName, colors } from '../../theme';
import type { BookingFormState } from '../../lib/booking-flow';
import { StepHeading, styles, type ShopBranchVariant, type ShopOption } from './shared';

/** Same shape the `services` array is built into in the orchestrator (config-derived, or
 * shop-derived and merged with per-shop pricing) — kept local since it's only consumed here. */
interface ServiceOption {
  type: BookingType;
  label: string;
  description?: string;
  pricePerKg: number;
  basePricePerLoad?: number;
  basePricePerPiece?: number;
  basePricePerPair?: number;
  basePricePerItem?: number;
  fixedPrice?: number;
  pricingUnit: BranchPricingMode;
  minWeightKg: number;
  isCustom: boolean;
  customServiceId?: string;
}

interface ServiceStepProps {
  form: BookingFormState;
  setForm: Dispatch<SetStateAction<BookingFormState>>;
  services: ServiceOption[];
  selectedShop: ShopOption | undefined;
  selectedBranch: ShopOption | ShopBranchVariant | undefined;
}

/** Step "service" of the booking flow — laundry service selection for the chosen shop (or the
 * default catalog when auto-dispatching). Extracted verbatim from `app/book.tsx`. */
export function ServiceStep({ form, setForm, services, selectedShop, selectedBranch }: ServiceStepProps) {
  return (
    <View>
      <StepHeading step="service" title="Choose service" />
      <View style={styles.shopContextCard}>
        {form.autoDispatch ? (
          <View style={styles.autoDispatchIcon}>
            <Ionicons name="flash" size={18} color={colors.primary} />
          </View>
        ) : selectedShop?.logoUrl ? (
          <Image source={{ uri: resolveMediaUrl(selectedShop.logoUrl) }} style={styles.shopLogo} />
        ) : (
          <View style={styles.shopLogoFallback}>
            <Ionicons name="storefront-outline" size={20} color={colors.primary} />
          </View>
        )}
        <View style={styles.summaryShopTextGroup}>
          <Text style={styles.summaryMuted}>Booking with</Text>
          <Text style={styles.summaryShopName}>
            {form.autoDispatch ? `${brandName}'s pick (best available)` : (selectedBranch?.name ?? 'Selected shop')}
          </Text>
        </View>
      </View>
      {services.map((s) => {
        const selected = s.isCustom
          ? form.customServiceId === s.customServiceId
          : form.bookingType === s.type && !form.customServiceId;
        return (
          <Pressable
            key={s.customServiceId ?? s.type}
            style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
            onPress={() =>
              setForm((f) => ({
                ...f,
                bookingType: s.type as BookingType,
                customServiceId: s.customServiceId ?? '',
              }))
            }
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <View style={styles.optionTopRow}>
              <Text style={styles.optionTitle}>
                {s.label}
                {s.isCustom ? <Text style={styles.optionBadge}> · Shop special</Text> : null}
              </Text>
              {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
            </View>
            <Text style={styles.optionSub}>{s.description}</Text>
            <Text style={styles.optionPrice}>
              {s.pricingUnit === BranchPricingMode.PER_LOAD && s.basePricePerLoad != null
                ? `${formatCurrency(s.basePricePerLoad)} / load`
                : s.pricingUnit === BranchPricingMode.PER_PIECE && s.basePricePerPiece != null
                  ? `${formatCurrency(s.basePricePerPiece)} / piece`
                  : s.pricingUnit === BranchPricingMode.PER_PAIR && s.basePricePerPair != null
                    ? `${formatCurrency(s.basePricePerPair)} / pair`
                    : s.pricingUnit === BranchPricingMode.PER_ITEM && s.basePricePerItem != null
                      ? `${formatCurrency(s.basePricePerItem)} / item`
                      : s.pricingUnit === BranchPricingMode.FIXED && s.fixedPrice != null
                        ? `${formatCurrency(s.fixedPrice)} fixed price`
                        : s.pricingUnit === BranchPricingMode.FLAT_BAG
                          ? 'Priced by bag size'
                          : `${formatCurrency(s.pricePerKg)} / kg · min ${s.minWeightKg} kg`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
