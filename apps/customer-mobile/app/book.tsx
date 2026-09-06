import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookingType, PaymentMethod, type OperatingHours } from '@lunara/types';
import {
  BOOKING_MACHINE_LOAD_MIN_KG,
  BOOKING_PER_KG_MIN_KG,
  BOOKING_MAX_WEIGHT_KG,
  resolvePerKgMaxKg,
  BranchPricingMode,
  estimateMachineLoads,
  EXPRESS_RETURN_ADDON_ID,
  calculateQuote,
  isExpressReturnAllowed,
  isGarmentPricedBookingType,
  type BagSizeId,
  type BranchHoliday,
  type CashTiming,
  type GarmentSelection,
  type QuoteBreakdown,
  validatePickupTime,
} from '@lunara/utils';
import { brandName, colors, spacing } from '../src/theme';
import { BookingProgress } from '../src/components/booking-progress';
import { Button } from '../src/components/ui/button';
import { BranchPickerSheet } from '../src/components/branch-picker-sheet';
import { getCustomerClientOrigin } from '../src/lib/client-origin';
import { toErrorMessage } from '../src/lib/api-error';
import {
  initialBookingForm,
  nextStep,
  prevStep,
  type BookingFormState,
  type BookingStep,
} from '../src/lib/booking-flow';
import { useAuthStore, getPartnerId } from '../src/store/auth';
import {
  addressHasCoords,
  buildGarmentSelectionsPayload,
  styles,
  type AddressOption,
  type BookingConfig,
  type ReorderSourceOrder,
  type ShopBranchVariant,
  type ShopOption,
} from '../src/components/book/shared';
import { AddressStep } from '../src/components/book/address-step';
import { ShopStep } from '../src/components/book/shop-step';
import { ServiceStep } from '../src/components/book/service-step';
import { ScheduleStep } from '../src/components/book/schedule-step';
import { WeightStep } from '../src/components/book/weight-step';
import { AddonsStep } from '../src/components/book/addons-step';
import { ReviewStep } from '../src/components/book/review-step';
import { ConfirmStep } from '../src/components/book/confirm-step';

export default function BookScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { service: serviceParam, code: codeParam, reorder: reorderParam } = useLocalSearchParams<{
    service?: string;
    code?: string;
    reorder?: string;
  }>();
  const apiFetch = useAuthStore((s) => s.apiFetch);
  const [step, setStep] = useState<BookingStep>('address');
  const [form, setForm] = useState<BookingFormState>(() => {
    const initial = { ...initialBookingForm };
    if (serviceParam && Object.values(BookingType).includes(serviceParam as BookingType)) {
      initial.bookingType = serviceParam as BookingType;
    }
    if (codeParam?.trim()) {
      initial.couponCode = codeParam.trim().toUpperCase();
    }
    return initial;
  });
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [operatingHours, setOperatingHours] = useState<OperatingHours | null>(null);
  const [holidays, setHolidays] = useState<BranchHoliday[]>([]);
  const [serverNow, setServerNow] = useState<string | undefined>(undefined);
  const [areaLabel, setAreaLabel] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [favoriteBranchIds, setFavoriteBranchIds] = useState<Set<string>>(new Set());
  const [branchSheetShopId, setBranchSheetShopId] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.GCASH);
  const [cashTiming, setCashTiming] = useState<CashTiming>('pickup');
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const placingOrderRef = useRef(false);
  const [error, setError] = useState('');
  const [configLoading, setConfigLoading] = useState(true);
  const [addressesError, setAddressesError] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [reorderNotice, setReorderNotice] = useState('');
  const reorderAppliedRef = useRef(false);
  const pendingRebookBranchRef = useRef<string | null>(null);

  useEffect(() => {
    setConfigLoading(true);
    apiFetch<BookingConfig>('/booking/config')
      .then(setConfig)
      .catch((e) => setError(toErrorMessage(e, 'Could not load services')))
      .finally(() => setConfigLoading(false));
    apiFetch<AddressOption[]>('/addresses')
      .then((list) => {
        setAddresses(list);
        const defaultAddress = list.find((a) => a.isDefault) ?? list[0];
        if (defaultAddress && !reorderParam) setForm((f) => ({ ...f, addressId: defaultAddress._id }));
        setAddressesError('');
      })
      .catch((e) => setAddressesError(toErrorMessage(e, 'Could not load addresses')));
    apiFetch<{ branchId: string }[]>('/favorites')
      .then((list) => setFavoriteBranchIds(new Set(list.map((f) => f.branchId))))
      .catch(() => {});
  }, [apiFetch, reorderParam]);

  async function toggleFavoriteBranch(branchId: string) {
    const isFavorited = favoriteBranchIds.has(branchId);
    setFavoriteBranchIds((prev) => {
      const next = new Set(prev);
      if (isFavorited) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
    try {
      if (isFavorited) {
        await apiFetch(`/favorites/${branchId}`, { method: 'DELETE' });
      } else {
        await apiFetch('/favorites', { method: 'POST', body: JSON.stringify({ branchId }) });
      }
    } catch {
      setFavoriteBranchIds((prev) => {
        const next = new Set(prev);
        if (isFavorited) next.add(branchId);
        else next.delete(branchId);
        return next;
      });
    }
  }

  // "Reorder" from order history: prefill the same shop, service, bag size, and add-ons once
  // addresses have loaded (needed to check the order's old pickup address is still valid).
  useEffect(() => {
    if (!reorderParam || reorderAppliedRef.current || addresses.length === 0) return;
    reorderAppliedRef.current = true;
    apiFetch<ReorderSourceOrder>(`/orders/${reorderParam}`)
      .then((order) => {
        const addressStillValid = addresses.some((a) => a._id === order.pickupAddressId);
        setForm((f) => ({
          ...f,
          bookingType: order.bookingType,
          bagSizeId: (order.bagSizeId as BagSizeId | undefined) ?? f.bagSizeId,
          addonIds: order.addons?.map((a) => a.id) ?? [],
          addonQuantities: Object.fromEntries(
            (order.addons ?? []).map((a) => [a.id, a.quantity ?? 1]),
          ),
          addressId: addressStillValid && order.pickupAddressId ? order.pickupAddressId : f.addressId,
          branchId: order.branchId ?? '',
          autoDispatch: false,
        }));
        if (order.branchId) pendingRebookBranchRef.current = order.branchId;
        if (!addressStillValid) {
          setReorderNotice(
            "We prefilled your last order, but its pickup address is no longer available — please choose one.",
          );
        }
      })
      .catch(() =>
        setReorderNotice('Could not load your previous order. Please build a new booking.'),
      );
  }, [reorderParam, addresses, apiFetch]);

  // Once shops for the (re-)resolved address have loaded, confirm the rebooked shop is still
  // available before letting the customer skip past the shop step with a stale selection.
  useEffect(() => {
    if (!pendingRebookBranchRef.current || shopsLoading) return;
    const rebookBranchId = pendingRebookBranchRef.current;
    pendingRebookBranchRef.current = null;
    const stillAvailable = shopOptions.some(
      (s) => s.branchId === rebookBranchId && s.withinRadius && s.capacityAvailable,
    );
    if (!stillAvailable) {
      setForm((f) => (f.branchId === rebookBranchId ? { ...f, branchId: '' } : f));
      setReorderNotice(
        `Your previous shop isn't available right now — choose another or let ${brandName} pick one for you.`,
      );
    }
  }, [shopOptions, shopsLoading]);

  // A partner's other branches are listed under `shop.branches[]`, keyed by the nearest branch's
  // id (`shop.branchId`) — picking a non-nearest variant via BranchPickerSheet still needs to
  // resolve back to that shop's pricing/services (the API doesn't expose per-variant pricing).
  const selectedShop = shopOptions.find(
    (s) => s.branchId === form.branchId || s.branches.some((b) => b.branchId === form.branchId),
  );
  // The customer may have picked a non-nearest branch variant via BranchPickerSheet — that
  // variant carries its own name/city, so anything shown to the customer must reflect it rather
  // than falling back to the parent shop's nearest-branch name.
  const selectedBranch: ShopOption | ShopBranchVariant | undefined = selectedShop
    ? selectedShop.branchId === form.branchId
      ? selectedShop
      : (selectedShop.branches.find((b) => b.branchId === form.branchId) ?? selectedShop)
    : undefined;
  const shopKgPerLoad = selectedShop?.kgPerLoad ?? BOOKING_MACHINE_LOAD_MIN_KG;

  const services = useMemo(() => {
    if (selectedShop) {
      return selectedShop.services.map((s) => {
        const catalogMatch = config?.services.find((cs) => cs.type === s.type);
        return {
          type: s.type,
          label: s.label,
          description: s.description ?? catalogMatch?.description ?? '',
          pricePerKg: s.customerPricePerKg,
          basePricePerLoad: s.customerPricePerLoad,
          basePricePerPiece: s.customerPricePerPiece,
          basePricePerPair: s.customerPricePerPair,
          basePricePerItem: s.customerPricePerItem,
          fixedPrice: s.customerFixedPrice,
          pricingUnit: s.pricingUnit ?? (s.isCustom ? BranchPricingMode.PER_KG : BranchPricingMode.FLAT_BAG),
          minWeightKg: catalogMatch?.minWeightKg ?? 5,
          isCustom: s.isCustom ?? false,
          customServiceId: s.customServiceId,
        };
      });
    }
    return (config?.services ?? []).map((s) => ({
      ...s,
      basePricePerLoad: undefined,
      basePricePerPiece: undefined,
      basePricePerPair: undefined,
      basePricePerItem: undefined,
      fixedPrice: undefined,
      pricingUnit: BranchPricingMode.FLAT_BAG,
      isCustom: false,
      customServiceId: undefined,
    }));
  }, [config, selectedShop]);

  const addons = useMemo(() => {
    // Percent-of-service add-ons (Express/Same-Day) are order-level, not scoped to any specific
    // service — always shown regardless of applicableServiceTypes.
    const appliesToSelection = (applicableServiceTypes?: string[], isPercentOfService?: boolean) =>
      isPercentOfService ||
      !form.bookingType ||
      !!applicableServiceTypes?.includes(form.bookingType);
    if (selectedShop) {
      return selectedShop.addons
        .filter((a) => appliesToSelection(a.applicableServiceTypes, a.isPercentOfService))
        .map((a) => {
          const catalogMatch = config?.addons.find((ca) => ca.id === a.slug);
          return {
            id: a.slug,
            label: a.label,
            description: a.description ?? catalogMatch?.description ?? '',
            price: a.customerPrice,
            pricingUnit: a.pricingUnit ?? BranchPricingMode.FLAT_BAG,
            isPercentOfService: a.isPercentOfService,
            imageUrl: catalogMatch?.imageUrl,
            isCustom: a.isCustom ?? false,
            allowsQuantity: a.allowsQuantity ?? catalogMatch?.allowsQuantity,
            maxQuantity: a.maxQuantity ?? catalogMatch?.maxQuantity,
            includedQuantity: a.includedQuantity,
          };
        });
    }
    return (config?.addons ?? []).map((a) => ({
      ...a,
      pricingUnit: BranchPricingMode.FLAT_BAG,
      isCustom: false,
    }));
  }, [config, selectedShop, form.bookingType]);

  // Add-ons a partner connected to the selected service are pre-checked for the customer (still
  // removable) the first time they appear — tracked in a ref so a manual uncheck sticks afterward.
  const autoAddedAddonIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const connectedIds = addons.filter((a) => !a.isPercentOfService).map((a) => a.id);
    const newlyConnected = connectedIds.filter((id) => !autoAddedAddonIdsRef.current.has(id));
    if (newlyConnected.length === 0) return;
    newlyConnected.forEach((id) => autoAddedAddonIdsRef.current.add(id));
    setForm((f) => {
      const toAdd = newlyConnected.filter((id) => !f.addonIds.includes(id));
      return toAdd.length === 0 ? f : { ...f, addonIds: [...f.addonIds, ...toAdd] };
    });
  }, [addons]);

  useEffect(() => {
    setForm((f) => {
      const validIds = new Set(addons.map((a) => a.id));
      const pruned = f.addonIds.filter((id) => validIds.has(id));
      return pruned.length === f.addonIds.length ? f : { ...f, addonIds: pruned };
    });
  }, [addons]);

  // Each service on a shop can bill in its own unit now, so this must be resolved per selected
  // service (and re-derived whenever bookingType/customServiceId changes), not once per shop.
  // Custom services are always priced per-kg (see partner-web services page).
  const selectedShopService = form.customServiceId
    ? selectedShop?.services.find((s) => s.customServiceId === form.customServiceId)
    : selectedShop?.services.find((s) => s.type === form.bookingType && !s.isCustom);
  const shopPricingMode =
    selectedShopService?.pricingUnit ??
    (form.customServiceId ? BranchPricingMode.PER_KG : BranchPricingMode.FLAT_BAG);

  const localQuote = useMemo(() => {
    if (!form.bookingType) return null;
    const catalogService = config?.services.find((s) => s.type === form.bookingType);
    const shopService = selectedShopService;
    const service =
      catalogService && shopService ? { ...catalogService, label: shopService.label } : catalogService;

    const enteredWeightKg = Number(form.enteredWeightKg) || undefined;
    const enteredLoadCount = Number(form.enteredLoadCount) || undefined;
    const enteredPieceCount = Number(form.enteredPieceCount) || undefined;
    const garmentPriced = isGarmentPricedBookingType(form.bookingType);
    const garmentSelections: GarmentSelection[] = garmentPriced
      ? Object.entries(form.garmentQuantities)
          .map(([garmentId, qty]) => ({ garmentId, quantity: Number(qty) || 0 }))
          .filter((sel) => sel.quantity > 0)
      : [];

    if (garmentPriced) {
      if (garmentSelections.length === 0) return null;
    } else if (shopPricingMode === BranchPricingMode.FLAT_BAG) {
      if (!form.bagSizeId) return null;
    } else if (shopPricingMode === BranchPricingMode.FIXED) {
      // No customer input needed — the price is fixed regardless of quantity.
    } else if (shopPricingMode === BranchPricingMode.PER_KG) {
      if (!enteredWeightKg) return null;
    } else if (
      shopPricingMode === BranchPricingMode.PER_PIECE ||
      shopPricingMode === BranchPricingMode.PER_PAIR ||
      shopPricingMode === BranchPricingMode.PER_ITEM
    ) {
      if (!enteredPieceCount) return null;
    } else if (!enteredWeightKg && !enteredLoadCount) {
      return null;
    }

    // Shop-specific addon prices/units when a shop is chosen — falls back to the flat global
    // catalog before a shop is picked, matching the `addons` render list below.
    const addonOptions = selectedShop
      ? selectedShop.addons.map((a) => {
          const catalogMatch = config?.addons.find((ca) => ca.id === a.slug);
          return {
            id: a.slug,
            label: a.label,
            description: a.description ?? '',
            price: a.customerPrice,
            pricingUnit: a.pricingUnit ?? BranchPricingMode.FLAT_BAG,
            isPercentOfService: a.isPercentOfService,
            allowsQuantity: a.allowsQuantity ?? catalogMatch?.allowsQuantity,
            maxQuantity: a.maxQuantity ?? catalogMatch?.maxQuantity,
            includedQuantity: a.includedQuantity,
          };
        })
      : config?.addons;

    try {
      return calculateQuote(
        {
          bookingType: form.bookingType,
          bagSizeId: form.bagSizeId || undefined,
          addonIds: form.addonIds,
          pricingMode: shopPricingMode,
          // Local preview must price off what the customer actually pays, not the partner's raw
          // rate, or this preview would undercount versus the real order total.
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
          addonQuantities: form.addonQuantities,
        },
        service,
        addonOptions,
      );
    } catch {
      return null;
    }
  }, [
    form.bookingType,
    form.customServiceId,
    form.bagSizeId,
    form.enteredWeightKg,
    form.enteredLoadCount,
    form.enteredPieceCount,
    form.garmentQuantities,
    form.addonIds,
    form.addonQuantities,
    config?.services,
    config?.addons,
    selectedShop,
    selectedShopService,
    shopKgPerLoad,
    shopPricingMode,
  ]);

  const loadAvailability = useCallback(
    async (addressId: string, branchId?: string) => {
      setAvailabilityError('');
      setAvailabilityLoading(true);
      try {
        const branchParam = branchId ? `&branchId=${encodeURIComponent(branchId)}` : '';
        const avail = await apiFetch<{
          areaLabel: string;
          operatingHours: OperatingHours;
          holidays?: BranchHoliday[];
          serverNow?: string;
          dispatchNote?: string;
        }>(`/booking/availability?addressId=${encodeURIComponent(addressId)}${branchParam}`);
        setAreaLabel(avail.areaLabel);
        setOperatingHours(avail.operatingHours);
        setHolidays(avail.holidays ?? []);
        setServerNow(avail.serverNow);
        setDispatchNote(avail.dispatchNote ?? '');
        setForm((f) => {
          const stillValid =
            f.scheduledPickupAt &&
            validatePickupTime(f.scheduledPickupAt, avail.operatingHours, avail.holidays ?? []).valid;
          return stillValid ? f : { ...f, scheduledPickupAt: '' };
        });
      } catch (e) {
        setAvailabilityError(
          toErrorMessage(e, 'Could not load pickup schedule'),
        );
        setOperatingHours(null);
        setAreaLabel('');
      } finally {
        setAvailabilityLoading(false);
      }
    },
    [apiFetch],
  );

  const loadShops = useCallback(
    async (addressId: string) => {
      setShopsLoading(true);
      try {
        const res = await apiFetch<ShopOption[]>(
          `/booking/shops?addressId=${encodeURIComponent(addressId)}`,
        );
        // A white-labeled partner build only ever books that partner's own shop (the API
        // force-resolves to it regardless of branchId — see buildQuote's partnerContextId
        // handling), so surfacing other partners' shops here would just be misleading.
        const partnerId = getPartnerId();
        const all = res ?? [];
        const partnerShops = partnerId ? all.filter((s) => s.partnerUserId === partnerId) : all;
        // If this partner has no shops assigned yet, an empty list is worse than showing the
        // full network — fall back to the default (unfiltered) behavior rather than a dead end.
        setShopOptions(partnerId && partnerShops.length === 0 ? all : partnerShops);
      } catch {
        setShopOptions([]);
      } finally {
        setShopsLoading(false);
      }
    },
    [apiFetch],
  );

  useEffect(() => {
    if (!form.addressId) return;
    loadAvailability(form.addressId);
    loadShops(form.addressId);
    // Reset when the address changes — the branch-scoped effect below re-applies
    // form.branchId once a shop is (re)selected for the new address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.addressId]);

  // Once a specific shop is chosen, pickup slots must reflect that shop's own hours instead of
  // the network-wide union offered before a shop was picked — otherwise a slot can look bookable
  // here but get rejected at checkout once validated against the actual shop's operatingHours.
  useEffect(() => {
    if (!form.addressId || form.autoDispatch) return;
    if (!form.branchId) return;
    loadAvailability(form.addressId, form.branchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.branchId, form.autoDispatch]);

  useEffect(() => {
    if (step !== 'confirm') return;
    apiFetch<{ balance: number }>('/wallets/me')
      .then((data) => setWalletBalance(data.balance))
      .catch(() => setWalletBalance(0));
  }, [apiFetch, step]);

  const expressReturnAllowed = isExpressReturnAllowed(form.scheduledPickupAt);

  useEffect(() => {
    if (expressReturnAllowed) return;
    setForm((f) =>
      f.addonIds.includes(EXPRESS_RETURN_ADDON_ID)
        ? { ...f, addonIds: f.addonIds.filter((id) => id !== EXPRESS_RETURN_ADDON_ID) }
        : f,
    );
  }, [expressReturnAllowed]);

  async function refreshQuote(couponCode = form.couponCode) {
    if (!form.bookingType || !form.addressId || (!form.branchId && !form.autoDispatch)) return null;
    const q = await apiFetch<QuoteBreakdown>(
      `/booking/quote?addressId=${encodeURIComponent(form.addressId)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          services: [
            {
              bookingType: form.bookingType,
              ...(form.customServiceId ? { customServiceId: form.customServiceId } : {}),
              ...(form.bagSizeId ? { bagSizeId: form.bagSizeId } : {}),
              ...(Number(form.enteredWeightKg) ? { enteredWeightKg: Number(form.enteredWeightKg) } : {}),
              ...(Number(form.enteredLoadCount) ? { enteredLoadCount: Number(form.enteredLoadCount) } : {}),
              ...(Number(form.enteredPieceCount) ? { enteredPieceCount: Number(form.enteredPieceCount) } : {}),
              ...(buildGarmentSelectionsPayload(form) ? { garmentSelections: buildGarmentSelectionsPayload(form) } : {}),
            },
          ],
          ...(form.branchId ? { branchId: form.branchId } : {}),
          addonIds: form.addonIds,
          addonQuantities: form.addonQuantities,
          ...(form.scheduledPickupAt ? { scheduledPickupAt: form.scheduledPickupAt } : {}),
          ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
        }),
      },
    );
    setQuote(q);
    return q;
  }

  async function applyPromoCode() {
    setPromoLoading(true);
    setError('');
    try {
      await refreshQuote(form.couponCode);
    } catch (e) {
      setQuote(null);
      setError(toErrorMessage(e, 'Could not apply promo code'));
    } finally {
      setPromoLoading(false);
    }
  }

  async function removePromoCode() {
    setForm((f) => ({ ...f, couponCode: '' }));
    setPromoLoading(true);
    setError('');
    try {
      await refreshQuote('');
    } catch (e) {
      setError(toErrorMessage(e, 'Could not refresh price'));
    } finally {
      setPromoLoading(false);
    }
  }

  const selectedAddress = addresses.find((a) => a._id === form.addressId);
  const showScheduleSupport =
    step === 'schedule' &&
    Boolean(form.addressId) &&
    !availabilityLoading &&
    (Boolean(availabilityError) || !operatingHours);

  async function goNext() {
    setError('');
    if (step === 'service' && !form.bookingType) {
      setError('Select a service');
      return;
    }
    if (step === 'address') {
      if (!form.addressId) {
        setError('Select an address');
        return;
      }
      const selected = addresses.find((a) => a._id === form.addressId);
      if (!addressHasCoords(selected)) {
        setError('Selected address has no GPS pin. Update it in Profile with "Use current location".');
        return;
      }
    }
    if (step === 'shop' && !form.branchId && !form.autoDispatch) {
      setError(`Select a laundry shop or let ${brandName} pick one for you`);
      return;
    }
    if (step === 'schedule' && !form.scheduledPickupAt) {
      setError('Select a pickup time');
      return;
    }
    if (step === 'weight') {
      const garmentPriced = Boolean(form.bookingType && isGarmentPricedBookingType(form.bookingType));
      if (garmentPriced) {
        const hasSelection = Object.values(form.garmentQuantities).some((q) => Number(q) > 0);
        if (!hasSelection) {
          setError('Select at least one garment');
          return;
        }
      } else if (shopPricingMode === BranchPricingMode.FLAT_BAG && !form.bagSizeId) {
        setError('Choose a bag size');
        return;
      }
      if (!garmentPriced && shopPricingMode === BranchPricingMode.PER_KG && !Number(form.enteredWeightKg)) {
        setError('Enter the estimated weight');
        return;
      }
      if (
        (shopPricingMode === BranchPricingMode.PER_KG || shopPricingMode === BranchPricingMode.PER_LOAD) &&
        Number(form.enteredWeightKg) &&
        Number(form.enteredWeightKg) < BOOKING_PER_KG_MIN_KG
      ) {
        setError(`Minimum booking weight is ${BOOKING_PER_KG_MIN_KG} kg`);
        return;
      }
      if (
        shopPricingMode === BranchPricingMode.PER_KG &&
        Number(form.enteredWeightKg) > resolvePerKgMaxKg(shopKgPerLoad)
      ) {
        setError(`Per-kg pricing only covers up to ${resolvePerKgMaxKg(shopKgPerLoad)} kg`);
        return;
      }
      if (
        shopPricingMode === BranchPricingMode.PER_LOAD &&
        !Number(form.enteredWeightKg) &&
        !Number(form.enteredLoadCount)
      ) {
        setError('Enter the estimated weight or load count');
        return;
      }
      if (
        shopPricingMode === BranchPricingMode.PER_LOAD &&
        Number(form.enteredWeightKg) > BOOKING_MAX_WEIGHT_KG
      ) {
        setError(`Enter a realistic weight — up to ${BOOKING_MAX_WEIGHT_KG} kg per order`);
        return;
      }
      if (
        shopPricingMode === BranchPricingMode.PER_LOAD &&
        Number(form.enteredLoadCount) > estimateMachineLoads(BOOKING_MAX_WEIGHT_KG, shopKgPerLoad)
      ) {
        setError('Enter a realistic load count for this order');
        return;
      }
      if (
        !garmentPriced &&
        (shopPricingMode === BranchPricingMode.PER_PIECE ||
          shopPricingMode === BranchPricingMode.PER_PAIR ||
          shopPricingMode === BranchPricingMode.PER_ITEM) &&
        !Number(form.enteredPieceCount)
      ) {
        setError('Enter the count');
        return;
      }
    }
    if (step === 'review') {
      try {
        await refreshQuote();
      } catch (e) {
        setError(toErrorMessage(e, 'Could not calculate price'));
        return;
      }
    }
    const n = nextStep(step);
    if (n) setStep(n);
  }

  function goBack() {
    setError('');
    const p = prevStep(step);
    if (p) setStep(p);
    else router.back();
  }

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={goBack} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
      ),
    });
    // `goBack`/`navigation` intentionally excluded: `goBack` is redefined every render and
    // already closes over the current `step`, so re-running this effect only on `step` change
    // (not on every render) is correct and avoids redundant header resets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function placeOrder() {
    if (
      !form.bookingType ||
      !form.addressId ||
      (!form.branchId && !form.autoDispatch) ||
      !form.scheduledPickupAt
    )
      return;
    if (placingOrderRef.current) return;
    placingOrderRef.current = true;
    setLoading(true);
    setError('');

    // Order creation and payment initiation are two separate API calls — if the order is
    // created but the payment step then fails, the order still exists as a real PENDING order
    // (not nothing), so retrying from scratch would create a *duplicate*. Route to the existing
    // standalone checkout screen (which already knows how to load/retry payment for an existing
    // order) instead of just showing a generic failure and leaving an orphaned order behind.
    let createdOrderId: string | null = null;
    try {
      const order = await apiFetch<{ _id: string; total: number }>('/booking/orders', {
        method: 'POST',
        body: JSON.stringify({
          services: [
            {
              bookingType: form.bookingType,
              ...(form.customServiceId ? { customServiceId: form.customServiceId } : {}),
              ...(form.bagSizeId ? { bagSizeId: form.bagSizeId } : {}),
              ...(Number(form.enteredWeightKg) ? { enteredWeightKg: Number(form.enteredWeightKg) } : {}),
              ...(Number(form.enteredLoadCount) ? { enteredLoadCount: Number(form.enteredLoadCount) } : {}),
              ...(Number(form.enteredPieceCount) ? { enteredPieceCount: Number(form.enteredPieceCount) } : {}),
              ...(buildGarmentSelectionsPayload(form) ? { garmentSelections: buildGarmentSelectionsPayload(form) } : {}),
            },
          ],
          ...(form.branchId ? { branchId: form.branchId } : {}),
          addonIds: form.addonIds,
          addonQuantities: form.addonQuantities,
          pickupAddressId: form.addressId,
          scheduledPickupAt: form.scheduledPickupAt,
          ...(form.couponCode.trim() ? { couponCode: form.couponCode.trim() } : {}),
        }),
      });
      createdOrderId = order._id;

      const payment = await apiFetch<{
        paid?: boolean;
        checkoutUrl?: string;
        payment?: { _id: string };
        receiptCode?: string;
        message?: string;
      }>('/payments/intent', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order._id,
          method: paymentMethod,
          clientOrigin: getCustomerClientOrigin(),
          ...(paymentMethod === PaymentMethod.CASH ? { cashTiming } : {}),
        }),
      });

      const goToOrder = () => router.replace(`/orders/${order._id}`);

      if (payment.paid) {
        Alert.alert(
          'Booked!',
          'Payment received. Your laundry shop has been notified.',
          [{ text: 'Track order', onPress: goToOrder }],
        );
        return;
      }

      if (paymentMethod === PaymentMethod.CASH) {
        Alert.alert(
          'Booking confirmed',
          payment.message ??
          (payment.receiptCode
            ? `Pay cash as arranged. Reference: ${payment.receiptCode}`
            : 'Pay cash as arranged. Your laundry shop has been notified.'),
          [{ text: 'Track order', onPress: goToOrder }],
        );
        return;
      }

      if (payment.checkoutUrl) {
        await Linking.openURL(payment.checkoutUrl);
        Alert.alert(
          'Complete payment',
          'Finish payment in your browser, then return here to track your order.',
          [{ text: 'Track order', onPress: goToOrder }],
        );
        return;
      }

      Alert.alert(
        'Order created',
        'We could not start payment automatically. Continue to checkout to complete payment for this order.',
        [{ text: 'Go to checkout', onPress: () => router.replace(`/checkout/${order._id}`) }],
      );
    } catch (e) {
      if (createdOrderId) {
        Alert.alert(
          'Order created',
          'Your order was created, but we could not start payment. Continue to checkout to complete payment.',
          [{ text: 'Go to checkout', onPress: () => router.replace(`/checkout/${createdOrderId}`) }],
        );
      } else {
        setError(toErrorMessage(e, 'Booking failed'));
      }
    } finally {
      placingOrderRef.current = false;
      setLoading(false);
    }
  }

  const activeQuote = quote ?? localQuote;
  const reviewBlocked = step === 'review' && activeQuote ? !activeQuote.meetsMinimum : false;
  const insufficientWallet =
    paymentMethod === PaymentMethod.WALLET &&
    walletBalance < (activeQuote?.total ?? 0);

  function payButtonLabel() {
    if (loading) return 'Processing…';
    if (paymentMethod === PaymentMethod.CASH) return 'Confirm & get receipt';
    if (paymentMethod === PaymentMethod.WALLET) return 'Pay with wallet';
    return 'Continue to PayMongo';
  }

  return (
    <View style={styles.container}>
      <BookingProgress current={step} />

        <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: spacing.xxxl + insets.bottom }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {configLoading && !config ? (
            <Text style={styles.sub}>Loading services…</Text>
          ) : null}

          {step === 'address' && (
            <AddressStep
              form={form}
              setForm={setForm}
              addresses={addresses}
              addressesError={addressesError}
              dispatchNote={dispatchNote}
              onAddAddress={() => router.push('/(tabs)/profile')}
            />
          )}

          {step === 'shop' && (
            <ShopStep
              form={form}
              setForm={setForm}
              config={config}
              shopOptions={shopOptions}
              shopsLoading={shopsLoading}
              reorderNotice={reorderNotice}
              setReorderNotice={setReorderNotice}
              favoriteBranchIds={favoriteBranchIds}
              toggleFavoriteBranch={toggleFavoriteBranch}
              setBranchSheetShopId={setBranchSheetShopId}
            />
          )}

          {step === 'service' && config && (
            <ServiceStep
              form={form}
              setForm={setForm}
              services={services}
              selectedShop={selectedShop}
              selectedBranch={selectedBranch}
            />
          )}

          {step === 'schedule' && (
            <ScheduleStep
              form={form}
              setForm={setForm}
              availabilityError={availabilityError}
              areaLabel={areaLabel}
              operatingHours={operatingHours}
              holidays={holidays}
              serverNow={serverNow}
              showScheduleSupport={showScheduleSupport}
              selectedAddress={selectedAddress}
              onRetryAvailability={() => loadAvailability(form.addressId)}
            />
          )}

          {step === 'weight' && (
            <WeightStep
              form={form}
              setForm={setForm}
              selectedShop={selectedShop}
              config={config}
              localQuote={localQuote}
              shopPricingMode={shopPricingMode}
              shopKgPerLoad={shopKgPerLoad}
              addons={addons}
            />
          )}

          {step === 'addons' && (
            <AddonsStep
              form={form}
              setForm={setForm}
              addons={addons}
              expressReturnAllowed={expressReturnAllowed}
              shopPricingMode={shopPricingMode}
            />
          )}

          {step === 'review' && activeQuote && (
            <ReviewStep
              form={form}
              setForm={setForm}
              activeQuote={activeQuote}
              addons={addons}
              promoLoading={promoLoading}
              onApplyPromo={() => void applyPromoCode()}
              onRemovePromo={() => void removePromoCode()}
            />
          )}

          {step === 'confirm' && activeQuote && (
            <ConfirmStep
              form={form}
              activeQuote={activeQuote}
              selectedShop={selectedShop}
              selectedBranch={selectedBranch}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              cashTiming={cashTiming}
              setCashTiming={setCashTiming}
              walletBalance={walletBalance}
              onTopUpWallet={() => router.push('/(tabs)/wallet')}
            />
          )}

          <View style={styles.actions}>
            <Button label="Back" variant="outline" onPress={goBack} style={styles.secondaryBtn} />
            {step === 'confirm' ? (
              <Button
                label={payButtonLabel()}
                onPress={placeOrder}
                disabled={loading || insufficientWallet}
                style={styles.primaryBtn}
              />
            ) : (
              <Button
                label="Continue"
                onPress={goNext}
                disabled={reviewBlocked}
                style={styles.primaryBtn}
              />
            )}
          </View>
        </ScrollView>

      <BranchPickerSheet
        visible={branchSheetShopId !== null}
        shopName={shopOptions.find((s) => s.branchId === branchSheetShopId)?.name ?? ''}
        branches={shopOptions.find((s) => s.branchId === branchSheetShopId)?.branches ?? []}
        selectedBranchId={form.branchId}
        onSelect={(branchId) => {
          setReorderNotice('');
          setForm((f) => ({ ...f, branchId, autoDispatch: false }));
          setBranchSheetShopId(null);
        }}
        onClose={() => setBranchSheetShopId(null)}
      />
    </View>
  );
}
