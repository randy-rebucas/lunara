import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Dispatch, SetStateAction } from 'react';
import {
  BOOKING_MAX_WEIGHT_KG,
  BOOKING_MIN_ORDER_AMOUNT,
  BOOKING_PER_KG_MIN_KG,
  resolvePerKgMaxKg,
  BranchPricingMode,
  estimateMachineLoads,
  formatMachineLoadLabel,
  machineLoadInfo,
  formatCurrency,
  getGarmentCategories,
  GARMENT_CATALOG,
  isGarmentPricedBookingType,
  recommendBagForWeight,
  type BookingAddonOption,
  type QuoteBreakdown,
} from '@lunara/utils';
import { colors } from '../../theme';
import type { BookingFormState } from '../../lib/booking-flow';
import { StepHeading, WeightSlider, styles, type BookingConfig, type ShopOption } from './shared';

interface WeightStepProps {
  form: BookingFormState;
  setForm: Dispatch<SetStateAction<BookingFormState>>;
  selectedShop: ShopOption | undefined;
  config: BookingConfig | null;
  localQuote: QuoteBreakdown | null;
  shopPricingMode: BranchPricingMode;
  shopKgPerLoad: number;
  /** Same shape the orchestrator's `addons` memo produces — only `pricingUnit`/`id`/`label`/`price`
   * are read here. */
  addons: (BookingAddonOption & { pricingUnit: BranchPricingMode })[];
}

/** Step "weight" of the booking flow — covers every pricing-mode variant (garment selection,
 * flat bag size, per-kg slider, per-load slider, per-piece/pair/item count, fixed price).
 * Extracted verbatim from `app/book.tsx`; only the branch that matches `shopPricingMode` (and
 * whether the booking type is garment-priced) renders, exactly as before. */
export function WeightStep({
  form,
  setForm,
  selectedShop,
  config,
  localQuote,
  shopPricingMode,
  shopKgPerLoad,
  addons,
}: WeightStepProps) {
  const garmentPriced = Boolean(form.bookingType && isGarmentPricedBookingType(form.bookingType));

  if (garmentPriced) {
    return (
      <View>
        <StepHeading step="weight" title="Select your garments" />
        <Text style={styles.sub}>
          Pick each garment you&apos;re sending in and how many — priced per garment, no estimate needed.
        </Text>
        {getGarmentCategories(selectedShop?.garmentCatalog ?? GARMENT_CATALOG).map((category) => (
          <View key={category} style={styles.garmentCategoryCard}>
            <Text style={styles.optionTitle}>{category}</Text>
            {(selectedShop?.garmentCatalog ?? GARMENT_CATALOG)
              .filter((g) => g.category === category)
              .map((garment, i) => {
                const qty = Number(form.garmentQuantities[garment.id]) || 0;
                return (
                  <View key={garment.id} style={[styles.garmentRow, i === 0 && styles.garmentRowFirst]}>
                    <View>
                      <Text style={styles.optionSub}>{garment.label}</Text>
                      <Text style={styles.optionSub}>{formatCurrency(garment.price)} each</Text>
                    </View>
                    <View style={styles.garmentQtyRow}>
                      <Pressable
                        style={styles.garmentQtyBtn}
                        disabled={qty <= 0}
                        onPress={() =>
                          setForm((f) => ({
                            ...f,
                            garmentQuantities: {
                              ...f.garmentQuantities,
                              [garment.id]: String(Math.max(0, qty - 1)),
                            },
                          }))
                        }
                      >
                        <Ionicons name="remove" size={16} color={colors.foreground} />
                      </Pressable>
                      <Text style={styles.garmentQtyValue}>{qty}</Text>
                      <Pressable
                        style={styles.garmentQtyBtn}
                        onPress={() =>
                          setForm((f) => ({
                            ...f,
                            garmentQuantities: { ...f.garmentQuantities, [garment.id]: String(qty + 1) },
                          }))
                        }
                      >
                        <Ionicons name="add" size={16} color={colors.foreground} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
          </View>
        ))}
        {localQuote ? (
          <Text style={styles.optionPrice}>Subtotal: {formatCurrency(localQuote.serviceSubtotal)}</Text>
        ) : null}
      </View>
    );
  }

  if (shopPricingMode === BranchPricingMode.FLAT_BAG) {
    return (
      <View>
        <StepHeading step="weight" title="Choose a bag size" />
        <Text style={styles.sub}>
          Same flat price everywhere. We&apos;ll confirm actual weight at pickup. Min order{' '}
          {formatCurrency(config?.minOrderAmount ?? BOOKING_MIN_ORDER_AMOUNT)}.
        </Text>
        {(config?.bagSizes ?? []).map((bag) => {
          const selected = form.bagSizeId === bag.id;
          return (
            <Pressable
              key={bag.id}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
              onPress={() => setForm((f) => ({ ...f, bagSizeId: bag.id }))}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={styles.optionTopRow}>
                <Text style={styles.optionTitle}>{bag.label}</Text>
                {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
              </View>
              <Text style={styles.optionSub}>
                Up to {bag.capacityKg} kg · {formatMachineLoadLabel(bag.capacityKg)}
              </Text>
              <Text style={styles.optionPrice}>{formatCurrency(bag.price)}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (shopPricingMode === BranchPricingMode.PER_KG) {
    const perKgMaxKg = resolvePerKgMaxKg(shopKgPerLoad);
    const bag = recommendBagForWeight(Number(form.enteredWeightKg) || 0, config?.bagSizes ?? []);
    const belowMin = Number(form.enteredWeightKg) > 0 && Number(form.enteredWeightKg) < BOOKING_PER_KG_MIN_KG;
    const aboveMax = Number(form.enteredWeightKg) > perKgMaxKg;
    return (
      <View>
        <StepHeading step="weight" title="Estimate your weight" />
        <View style={styles.weightCard}>
          <View style={styles.weightIconRow}>
            <View style={styles.autoDispatchIcon}>
              <Ionicons name="scale-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.weightCardDesc}>
              Charged per kilo, for loads up to {perKgMaxKg} kg (minimum {BOOKING_PER_KG_MIN_KG} kg). Heavier
              loads are billed per machine load instead — {machineLoadInfo(shopKgPerLoad)}
            </Text>
          </View>
          <View style={styles.weightReadoutRow}>
            <Text style={styles.weightReadoutValue}>
              {form.enteredWeightKg ? Number(form.enteredWeightKg) : '—'}
            </Text>
            <Text style={styles.weightReadoutUnit}>kg</Text>
          </View>
          <WeightSlider
            value={form.enteredWeightKg}
            maxKg={perKgMaxKg}
            onChange={(v) => setForm((f) => ({ ...f, enteredWeightKg: v }))}
          />
          {bag ? (
            <View style={styles.weightHintPill}>
              <Ionicons name="bag-outline" size={13} color={colors.muted} />
              <Text style={styles.weightHintPillText}>
                Roughly a {bag.label} bag (up to {bag.capacityKg} kg)
              </Text>
            </View>
          ) : null}
          {belowMin ? (
            <View style={styles.warnPill}>
              <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
              <Text style={styles.warnPillText}>Minimum booking weight is {BOOKING_PER_KG_MIN_KG} kg</Text>
            </View>
          ) : null}
          {aboveMax ? (
            <View style={styles.warnPill}>
              <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
              <Text style={styles.warnPillText}>
                Above {perKgMaxKg} kg counts as {formatMachineLoadLabel(Number(form.enteredWeightKg), shopKgPerLoad)}{' '}
                instead of per-kg pricing
              </Text>
            </View>
          ) : null}
          {localQuote ? (
            <Text style={styles.weightPriceTag}>Estimated: {formatCurrency(localQuote.serviceSubtotal)}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  if (shopPricingMode === BranchPricingMode.PER_LOAD) {
    const bag = recommendBagForWeight(Number(form.enteredWeightKg) || 0, config?.bagSizes ?? []);
    const belowMin = Number(form.enteredWeightKg) > 0 && Number(form.enteredWeightKg) < BOOKING_PER_KG_MIN_KG;
    const aboveMax = Number(form.enteredWeightKg) > BOOKING_MAX_WEIGHT_KG;
    return (
      <View>
        <StepHeading step="weight" title="Estimate your load count" />
        <View style={styles.weightCard}>
          <View style={styles.weightIconRow}>
            <View style={styles.autoDispatchIcon}>
              <Ionicons name="layers-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.weightCardDesc}>
              Charged per machine load — minimum 1 load, up to {shopKgPerLoad} kg. Enter your estimated weight
              (or load count directly); we&apos;ll confirm the actual load count and final price at pickup.{' '}
              {machineLoadInfo(shopKgPerLoad)}
            </Text>
          </View>
          <View style={styles.weightReadoutRow}>
            <Text style={styles.weightReadoutValue}>
              {form.enteredWeightKg ? Number(form.enteredWeightKg) : '—'}
            </Text>
            <Text style={styles.weightReadoutUnit}>kg</Text>
          </View>
          <WeightSlider
            value={form.enteredWeightKg}
            maxKg={BOOKING_MAX_WEIGHT_KG}
            onChange={(v) =>
              setForm((f) => ({
                ...f,
                enteredWeightKg: v,
                enteredLoadCount: v ? String(estimateMachineLoads(Number(v) || 0, shopKgPerLoad)) : '',
              }))
            }
          />
          {form.enteredLoadCount ? (
            <View style={[styles.statusPill, styles.statusPillOpen]}>
              <Ionicons name="layers" size={12} color={colors.accentDark} />
              <Text style={[styles.statusPillText, styles.statusPillTextOpen]}>
                {form.enteredLoadCount} machine load{Number(form.enteredLoadCount) === 1 ? '' : 's'}
              </Text>
            </View>
          ) : null}
          {bag ? (
            <View style={styles.weightHintPill}>
              <Ionicons name="bag-outline" size={13} color={colors.muted} />
              <Text style={styles.weightHintPillText}>
                Roughly a {bag.label} bag (up to {bag.capacityKg} kg)
              </Text>
            </View>
          ) : null}
          {belowMin ? (
            <View style={styles.warnPill}>
              <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
              <Text style={styles.warnPillText}>Minimum booking weight is {BOOKING_PER_KG_MIN_KG} kg</Text>
            </View>
          ) : null}
          {aboveMax ? (
            <View style={styles.warnPill}>
              <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
              <Text style={styles.warnPillText}>
                Enter a realistic weight — up to {BOOKING_MAX_WEIGHT_KG} kg per order
              </Text>
            </View>
          ) : null}
          {localQuote ? (
            <Text style={styles.weightPriceTag}>Estimated: {formatCurrency(localQuote.serviceSubtotal)}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  if (
    shopPricingMode === BranchPricingMode.PER_PIECE ||
    shopPricingMode === BranchPricingMode.PER_PAIR ||
    shopPricingMode === BranchPricingMode.PER_ITEM
  ) {
    const unitNoun =
      shopPricingMode === BranchPricingMode.PER_PAIR
        ? 'pair'
        : shopPricingMode === BranchPricingMode.PER_ITEM
          ? 'item'
          : 'piece';
    const perUnitItems = addons.filter((a) => a.pricingUnit === shopPricingMode);
    return (
      <View>
        <StepHeading step="weight" title={`Estimate your ${unitNoun} count`} />
        <View style={styles.weightCard}>
          <View style={styles.weightIconRow}>
            <View style={styles.autoDispatchIcon}>
              <Ionicons name="shirt-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.weightCardDesc}>
              Charged per {unitNoun}. Enter an estimated {unitNoun} count now — we&apos;ll confirm the actual
              count and final price at pickup. Min order{' '}
              {formatCurrency(config?.minOrderAmount ?? BOOKING_MIN_ORDER_AMOUNT)}.
            </Text>
          </View>
          <View style={styles.weightInputRow}>
            <TextInput
              style={styles.weightInputLarge}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              value={form.enteredPieceCount}
              onChangeText={(v) => setForm((f) => ({ ...f, enteredPieceCount: v }))}
            />
            <View style={styles.weightUnitChip}>
              <Text style={styles.weightUnitChipText}>{unitNoun}s</Text>
            </View>
          </View>
          {localQuote ? (
            <Text style={styles.weightPriceTag}>Estimated: {formatCurrency(localQuote.serviceSubtotal)}</Text>
          ) : null}
        </View>
        {perUnitItems.length > 0 ? (
          <View style={styles.weightCard}>
            <Text style={styles.optionTitle}>Items priced per {unitNoun}</Text>
            {perUnitItems.map((item) => (
              <View key={item.id} style={styles.addonRow}>
                <Text style={styles.optionSub}>{item.label}</Text>
                <Text style={styles.optionSub}>
                  {formatCurrency(item.price)} / {unitNoun}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  if (shopPricingMode === BranchPricingMode.FIXED) {
    return (
      <View>
        <StepHeading step="weight" title="Fixed price service" />
        <Text style={styles.sub}>This shop charges one flat price for this service, regardless of quantity.</Text>
        {localQuote ? (
          <Text style={styles.optionPrice}>Price: {formatCurrency(localQuote.serviceSubtotal)}</Text>
        ) : null}
      </View>
    );
  }

  return null;
}
