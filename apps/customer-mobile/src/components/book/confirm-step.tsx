import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Dispatch, SetStateAction } from 'react';
import { PaymentMethod } from '@lunara/types';
import { BranchPricingMode, formatCurrency, GARMENT_CATALOG, type CashTiming, type QuoteBreakdown } from '@lunara/utils';
import { PaymentMethodPicker } from '../payment-method-picker';
import { resolveMediaUrl } from '../../lib/media-url';
import { brandName, colors } from '../../theme';
import type { BookingFormState } from '../../lib/booking-flow';
import { StepHeading, styles, type ShopBranchVariant, type ShopOption } from './shared';

interface ConfirmStepProps {
  form: BookingFormState;
  activeQuote: QuoteBreakdown;
  selectedShop: ShopOption | undefined;
  selectedBranch: ShopOption | ShopBranchVariant | undefined;
  paymentMethod: PaymentMethod;
  setPaymentMethod: Dispatch<SetStateAction<PaymentMethod>>;
  cashTiming: CashTiming;
  setCashTiming: Dispatch<SetStateAction<CashTiming>>;
  walletBalance: number;
  onTopUpWallet: () => void;
}

/** Step "confirm" of the booking flow — final order summary + payment method picker. Extracted
 * verbatim from `app/book.tsx`; `placeOrder` (the actual `POST /booking/orders` +
 * `POST /payments/intent` calls) stays in the orchestrator. */
export function ConfirmStep({
  form,
  activeQuote,
  selectedShop,
  selectedBranch,
  paymentMethod,
  setPaymentMethod,
  cashTiming,
  setCashTiming,
  walletBalance,
  onTopUpWallet,
}: ConfirmStepProps) {
  return (
    <View>
      <StepHeading step="confirm" title="Confirm booking" />
      <View style={styles.summaryCard}>
        <View style={styles.summaryShopRow}>
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
            <Text style={styles.summaryMuted}>Shop</Text>
            <Text style={styles.summaryShopName}>
              {form.autoDispatch ? `${brandName}'s pick (best available)` : (selectedBranch?.name ?? 'Selected shop')}
            </Text>
          </View>
        </View>
        <Text style={styles.summaryLine}>
          <Text style={styles.summaryMuted}>Service: </Text>
          {activeQuote.serviceLabel}
        </Text>
        <Text style={styles.summaryLine}>
          <Text style={styles.summaryMuted}>
            {activeQuote.garmentSelections?.length
              ? 'Garments: '
              : activeQuote.pricingMode === BranchPricingMode.FLAT_BAG
                ? 'Bag size: '
                : activeQuote.pricingMode === BranchPricingMode.FIXED
                  ? 'Pricing: '
                  : activeQuote.pricingMode === BranchPricingMode.PER_PIECE
                    ? 'Estimated pieces: '
                    : activeQuote.pricingMode === BranchPricingMode.PER_PAIR
                      ? 'Estimated pairs: '
                      : activeQuote.pricingMode === BranchPricingMode.PER_ITEM
                        ? 'Estimated items: '
                        : 'Estimated weight: '}
          </Text>
          {activeQuote.garmentSelections?.length
            ? activeQuote.garmentSelections
                .map((g) => `${GARMENT_CATALOG.find((c) => c.id === g.garmentId)?.label ?? g.garmentId} ×${g.quantity}`)
                .join(', ')
            : activeQuote.pricingMode === BranchPricingMode.FLAT_BAG
              ? `${activeQuote.bagLabel} (up to ${activeQuote.weightKg} kg)`
              : activeQuote.pricingMode === BranchPricingMode.FIXED
                ? 'Fixed price'
                : activeQuote.pricingMode === BranchPricingMode.PER_PIECE
                  ? `${activeQuote.pieceCount ?? form.enteredPieceCount} pieces`
                  : activeQuote.pricingMode === BranchPricingMode.PER_PAIR
                    ? `${activeQuote.pieceCount ?? form.enteredPieceCount} pairs`
                    : activeQuote.pricingMode === BranchPricingMode.PER_ITEM
                      ? `${activeQuote.pieceCount ?? form.enteredPieceCount} items`
                      : `${activeQuote.weightKg} kg`}
        </Text>
        <Text style={styles.summaryLine}>
          <Text style={styles.summaryMuted}>Pickup: </Text>
          {form.scheduledPickupAt
            ? new Intl.DateTimeFormat('en-PH', {
                timeZone: 'Asia/Manila',
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(form.scheduledPickupAt))
            : 'Selected pickup time'}
        </Text>
        <Text style={styles.summaryLine}>
          <Text style={styles.summaryMuted}>{activeQuote.isEstimate ? 'Estimated total: ' : 'Total: '}</Text>
          <Text style={styles.summaryTotal}>{formatCurrency(activeQuote.total)}</Text>
        </Text>
        {activeQuote.deliveryFee > 0 &&
        activeQuote.deliveryDistanceKm != null &&
        activeQuote.deliveryBaseDistanceKm != null &&
        activeQuote.deliveryPerKmRate != null ? (
          <Text style={styles.optionSub}>
            Includes {formatCurrency(activeQuote.deliveryFee)} distance charge (
            {activeQuote.deliveryDistanceKm.toFixed(1)} km, beyond {activeQuote.deliveryBaseDistanceKm} km free
            radius) — no base delivery fee.
          </Text>
        ) : null}
        {activeQuote.isEstimate ? (
          <Text style={styles.optionSub}>We&apos;ll confirm the actual weight/load count and final price at pickup.</Text>
        ) : null}
      </View>
      <Text style={styles.confirmNote}>
        {form.autoDispatch
          ? `After payment, ${brandName} dispatches your order to the best available shop nearby.`
          : `Your order goes straight to ${selectedBranch?.name ?? 'your selected shop'} after payment.`}{' '}
        Pickup riders are notified once dispatched. Final amount may adjust after weigh-in.
      </Text>
      <PaymentMethodPicker
        method={paymentMethod}
        onMethodChange={setPaymentMethod}
        cashTiming={cashTiming}
        onCashTimingChange={setCashTiming}
        walletBalance={walletBalance}
        orderTotal={activeQuote.total}
        onTopUpWallet={onTopUpWallet}
      />
    </View>
  );
}
