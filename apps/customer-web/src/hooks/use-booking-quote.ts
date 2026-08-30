import { useMemo, useState } from 'react';
import type { useAuthContext } from '@lunara/hooks/auth-provider';
import {
  BranchPricingMode,
  calculateQuote,
  combineServiceQuotes,
  isGarmentPricedBookingType,
  type BookingAddonOption,
  type GarmentSelection,
  type LaundryServiceOption,
  type MultiServiceQuoteBreakdown,
  type QuoteBreakdown,
} from '@lunara/utils';
import type { BookingFormState } from '../lib/booking-flow';
import {
  resolveShopPricingMode,
  resolveShopService,
  serviceSelectionToRequestBody,
} from '../lib/booking-wizard-helpers';
import type { BookingConfig, ShopOption } from '../lib/booking-wizard-types';

/** Owns everything quote-related: the per-service local preview (client-side, instant), the
 * combined local quote, and the authoritative server quote (fetched on review/confirm and after
 * promo code changes). Kept separate from the wizard's step/navigation state since quoting only
 * depends on form.services/addons/coupon + the resolved shop/config, not on which step is active. */
export function useBookingQuote({
  api,
  form,
  config,
  selectedShop,
  addonOptions,
  shopKgPerLoad,
}: {
  api: ReturnType<typeof useAuthContext>['api'];
  form: BookingFormState;
  config: BookingConfig | null;
  selectedShop: ShopOption | undefined;
  addonOptions: BookingAddonOption[] | undefined;
  shopKgPerLoad: number;
}) {
  const [quote, setQuote] = useState<MultiServiceQuoteBreakdown | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  /** Per-service local quote preview — one entry per selected service, in `form.services` order,
   * `null` where that service's inputs aren't complete yet. Addons are NOT priced here (each
   * service is quoted addon-free); they're priced once on the combined total via
   * `combineServiceQuotes`, same as the server does. */
  const serviceQuotes = useMemo(() => {
    return form.services.map((service): QuoteBreakdown | null => {
      const catalogService = config?.services.find((s) => s.type === service.bookingType);
      const shopService = resolveShopService(selectedShop, service);
      const svc: LaundryServiceOption | undefined =
        catalogService && shopService ? { ...catalogService, label: shopService.label } : catalogService;
      const pricingMode = resolveShopPricingMode(selectedShop, service);

      const enteredWeightKg = Number(service.enteredWeightKg) || undefined;
      const enteredLoadCount = Number(service.enteredLoadCount) || undefined;
      const enteredPieceCount = Number(service.enteredPieceCount) || undefined;
      const garmentPriced = isGarmentPricedBookingType(service.bookingType);
      const garmentSelections: GarmentSelection[] = garmentPriced
        ? Object.entries(service.garmentQuantities)
            .map(([garmentId, qty]) => ({ garmentId, quantity: Number(qty) || 0 }))
            .filter((sel) => sel.quantity > 0)
        : [];

      if (garmentPriced) {
        if (garmentSelections.length === 0) return null;
      } else if (pricingMode === BranchPricingMode.FLAT_BAG) {
        if (!service.bagSizeId) return null;
      } else if (pricingMode === BranchPricingMode.FIXED) {
        // No customer input needed — the price is fixed regardless of quantity.
      } else if (pricingMode === BranchPricingMode.PER_KG) {
        if (!enteredWeightKg) return null;
      } else if (
        pricingMode === BranchPricingMode.PER_PIECE ||
        pricingMode === BranchPricingMode.PER_PAIR ||
        pricingMode === BranchPricingMode.PER_ITEM
      ) {
        if (!enteredPieceCount) return null;
      } else if (!enteredWeightKg && !enteredLoadCount) {
        return null;
      }

      try {
        return calculateQuote(
          {
            bookingType: service.bookingType,
            bagSizeId: service.bagSizeId || undefined,
            addonIds: [],
            pricingMode,
            // Local preview must price off what the customer actually pays (see the api-side
            // customerPriceXxx fields), not the partner's raw baseXxx rate, or this preview would
            // undercount versus the real order total.
            rates: {
              basePricePerKg: shopService?.customerPricePerKg,
              basePricePerLoad: shopService?.customerPricePerLoad,
              basePricePerPiece: shopService?.customerPricePerPiece,
              basePricePerPair: shopService?.customerPricePerPair,
              basePricePerItem: shopService?.customerPricePerItem,
              fixedPrice: shopService?.customerFixedPrice,
            },
            enteredWeightKg,
            enteredLoadCount,
            enteredPieceCount,
            garmentSelections,
            kgPerLoad: shopKgPerLoad,
          },
          svc,
          addonOptions,
        );
      } catch {
        return null;
      }
    });
  }, [form.services, config, selectedShop, addonOptions, shopKgPerLoad]);

  const localQuote = useMemo<MultiServiceQuoteBreakdown | null>(() => {
    if (serviceQuotes.length === 0 || serviceQuotes.some((q) => q == null)) return null;
    try {
      return combineServiceQuotes(
        serviceQuotes as QuoteBreakdown[],
        addonOptions ?? [],
        form.addonIds,
        config?.deliveryFee ?? 0,
        shopKgPerLoad,
        form.addonQuantities,
      );
    } catch {
      return null;
    }
  }, [serviceQuotes, addonOptions, form.addonIds, config, shopKgPerLoad, form.addonQuantities]);

  async function refreshServerQuote(couponCode = form.couponCode) {
    if (form.services.length === 0 || !form.addressId || (!form.branchId && !form.autoDispatch)) return null;
    const res = await api.post<MultiServiceQuoteBreakdown>(
      `/booking/quote?addressId=${encodeURIComponent(form.addressId)}`,
      {
        services: form.services.map(serviceSelectionToRequestBody),
        ...(form.branchId ? { branchId: form.branchId } : {}),
        addonIds: form.addonIds,
        addonQuantities: form.addonQuantities,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
      },
    );
    setQuote(res.data);
    return res.data;
  }

  async function applyPromoCode(): Promise<string> {
    setPromoLoading(true);
    try {
      await refreshServerQuote(form.couponCode);
      return '';
    } catch (err) {
      setQuote(null);
      return err instanceof Error ? err.message : 'Could not apply promo code';
    } finally {
      setPromoLoading(false);
    }
  }

  async function removePromoCode(): Promise<string> {
    setPromoLoading(true);
    try {
      await refreshServerQuote('');
      return '';
    } catch (err) {
      return err instanceof Error ? err.message : 'Could not refresh price';
    } finally {
      setPromoLoading(false);
    }
  }

  return {
    quote,
    serviceQuotes,
    localQuote,
    promoLoading,
    refreshServerQuote,
    applyPromoCode,
    removePromoCode,
  };
}
