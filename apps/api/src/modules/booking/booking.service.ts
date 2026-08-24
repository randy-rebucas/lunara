import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingType } from '@lunara/types';
import {
  applyShopMarkup,
  BAG_SIZES,
  BOOKING_MACHINE_LOAD_MIN_KG,
  BOOKING_MIN_ORDER_AMOUNT,
  BOOKING_MIN_WEIGHT_KG,
  BOOKING_PER_KG_MAX_KG,
  BranchPricingMode,
  calculateQuote,
  combineServiceQuotes,
  type BagSizeId,
  type GarmentSelection,
  GARMENT_CATALOG,
  distanceKm,
  EXPRESS_RETURN_ADDON_ID,
  getBagSize,
  isExpressReturnAllowed,
  isGarmentPricedBookingType,
  PICKUP_SCHEDULE_DAY_COUNT,
  PICKUP_SLOT_MIN_LEAD_MS,
  isServiceAvailableInArea,
  type QuoteBreakdown,
  resolveCoordinates,
  SHOP_PRICE_MARKUP_MULTIPLIER,
  validateAddressFields,
} from '@lunara/utils';
import { AddressesService } from '../addresses/addresses.service';
import { BranchesService } from '../branches/branches.service';
import { CatalogService } from '../catalog/catalog.service';
import { PromotionsService } from '../promotions/promotions.service';
import { SettingsService } from '../settings/settings.service';
import { ServiceAreasService } from '../service-areas/service-areas.service';
import { BookingQuoteDto, CreateBookingOrderDto, ServiceSelectionDto } from './dto/booking.dto';

@Injectable()
export class BookingService {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly branchesService: BranchesService,
    private readonly catalogService: CatalogService,
    private readonly promotionsService: PromotionsService,
    private readonly settingsService: SettingsService,
    private readonly serviceAreasService: ServiceAreasService,
  ) {}

  async getConfig() {
    const [services, addons, deliveryFees, serviceAreas] = await Promise.all([
      this.catalogService.listActiveServices(),
      this.catalogService.listActiveAddons(),
      this.settingsService.getDeliveryFeeSettings(),
      this.serviceAreasService.listActive(),
    ]);
    return {
      success: true,
      data: {
        services,
        addons,
        serviceAreas: serviceAreas.map((a) => ({
          id: a._id.toString(),
          label: a.label,
          cities: a.cities,
        })),
        minOrderAmount: BOOKING_MIN_ORDER_AMOUNT,
        bagSizes: BAG_SIZES,
        deliveryFee: deliveryFees.data.deliveryFee,
        garmentCatalog: GARMENT_CATALOG,
      },
    };
  }

  /** Nearby partner shops with their marked-up prices, for the customer's shop-selection step. */
  async getShopOptions(userId: string, addressId: string, partnerContextId?: string) {
    return this.branchesService.findNearbyShopsForAddressId(userId, addressId, partnerContextId);
  }

  async validateAddressForUser(userId: string, addressId: string) {
    const res = await this.addressesService.findAll(userId);
    const address = res.data.find((a) => a._id.toString() === addressId);
    if (!address) throw new NotFoundException('Address not found');

    const fields = {
      line1: address.line1,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
    };
    const fieldCheck = validateAddressFields(fields);
    if (!fieldCheck.valid) throw new BadRequestException(fieldCheck.message);

    // The admin-managed service-area list gives nicer labels and (per area) restricts which
    // service types are offered. But it's a maintained whitelist that doesn't scale as new
    // partners onboard in new cities — so it's an enrichment, not the sole gate. The real gate
    // is whether any active branch (across all partners) actually covers this address within
    // its service radius.
    const curatedArea = await this.serviceAreasService.resolveAreaForAddress(fields);

    const nearest = await this.branchesService.findNearestForAddress({
      city: address.city,
      latitude: address.latitude,
      longitude: address.longitude,
    });
    const nearestWithinRadius = nearest.ranked.find((r) => r.withinRadius);

    if (!curatedArea.valid && !nearestWithinRadius) {
      throw new BadRequestException(
        curatedArea.message ?? 'Laundry pickup is not available near this address yet.',
      );
    }

    const area = curatedArea.valid
      ? curatedArea
      : {
          valid: true as const,
          areaId: nearestWithinRadius!.branchId,
          areaLabel: nearestWithinRadius!.city,
          availableServices: [] as BookingType[],
        };

    return { address, area };
  }

  async getAvailability(userId: string, addressId: string, branchId?: string) {
    const { area } = await this.validateAddressForUser(userId, addressId);
    const { operatingHours, holidays } = await this.branchesService.resolvePickupSchedule(branchId);
    const partnerCoverage =
      (await this.branchesService.evaluatePartnerCoverageForAddressId(addressId)) ?? {
        hasPartnerNearby: false,
        inServiceArea: true,
        message: null,
      };

    return {
      success: true,
      data: {
        areaId: area.areaId,
        areaLabel: area.areaLabel,
        availableServices: area.availableServices,
        operatingHours,
        holidays,
        minLeadMs: PICKUP_SLOT_MIN_LEAD_MS,
        dayCount: PICKUP_SCHEDULE_DAY_COUNT,
        serverNow: new Date().toISOString(),
        partnerCoverage,
        dispatchNote: 'Next, choose which laundry shop you\'d like to book with.',
      },
    };
  }

  /** Prices one service line (today's per-service pricing-mode resolution + calculateQuote call)
   * against an already-resolved branch. Shared by buildQuote's per-service loop. */
  private async priceOneService(
    service: ServiceSelectionDto,
    branch: Awaited<ReturnType<BranchesService['getActivePartnerShop']>>,
  ): Promise<QuoteBreakdown> {
    const catalogService = await this.catalogService.findActiveByType(service.bookingType);
    if (!catalogService) throw new BadRequestException('Invalid or inactive service type');

    const garmentPriced = isGarmentPricedBookingType(service.bookingType);
    const branchGarmentCatalog = this.branchesService.resolveBranchGarmentCatalog(branch);
    if (garmentPriced) {
      if (!service.garmentSelections?.length) {
        throw new BadRequestException('Select at least one garment for this service');
      }
      const hiddenGarmentIds = new Set(branch.hiddenGarmentItemIds ?? []);
      const invalidGarment = service.garmentSelections.find(
        (g) => !GARMENT_CATALOG.some((c) => c.id === g.garmentId) || hiddenGarmentIds.has(g.garmentId),
      );
      if (invalidGarment) {
        throw new BadRequestException('Invalid garment selected');
      }
    }

    let pricingMode: BranchPricingMode = BranchPricingMode.FLAT_BAG;
    let pricingRates:
      | {
          basePricePerKg?: number;
          basePricePerLoad?: number;
          basePricePerPiece?: number;
          basePricePerPair?: number;
          basePricePerItem?: number;
          fixedPrice?: number;
          minWeightKg?: number;
        }
      | undefined;

    // Custom services carry their own pricingUnit/rates independent of the branch's base
    // BookingType pricing — don't fall back to resolveServicePricingUnit/branch.servicePricing
    // for them, or a per-item custom service would incorrectly price as whatever the branch's
    // base service happens to use.
    if (service.customServiceId) {
      const customPricing = await this.branchesService.resolveCustomServicePricing(
        branch,
        service.customServiceId,
      );
      pricingMode = customPricing.pricingMode;
      pricingRates = customPricing.rates;
    } else {
      pricingMode = this.branchesService.resolveServicePricingUnit(branch, service.bookingType);
      if (pricingMode !== BranchPricingMode.FLAT_BAG) {
        const servicePrice = branch.servicePricing?.find((p) => p.serviceType === service.bookingType);
        pricingRates = {
          basePricePerKg: servicePrice?.basePricePerKg,
          basePricePerLoad: servicePrice?.basePricePerLoad,
          basePricePerPiece: servicePrice?.basePricePerPiece,
          basePricePerPair: servicePrice?.basePricePerPair,
          basePricePerItem: servicePrice?.basePricePerItem,
          fixedPrice: servicePrice?.fixedPrice,
        };
      }
    }
    // Every non-flat-bag rate is the partner's own raw price — mark each one up by Lunara's cut
    // before it's used to price the order (flat-bag is a fixed platform price, never marked up here).
    if (pricingRates) {
      pricingRates = {
        basePricePerKg: pricingRates.basePricePerKg != null ? applyShopMarkup(pricingRates.basePricePerKg) : undefined,
        basePricePerLoad: pricingRates.basePricePerLoad != null ? applyShopMarkup(pricingRates.basePricePerLoad) : undefined,
        basePricePerPiece: pricingRates.basePricePerPiece != null ? applyShopMarkup(pricingRates.basePricePerPiece) : undefined,
        basePricePerPair: pricingRates.basePricePerPair != null ? applyShopMarkup(pricingRates.basePricePerPair) : undefined,
        basePricePerItem: pricingRates.basePricePerItem != null ? applyShopMarkup(pricingRates.basePricePerItem) : undefined,
        fixedPrice: pricingRates.fixedPrice != null ? applyShopMarkup(pricingRates.fixedPrice) : undefined,
        minWeightKg: pricingRates.minWeightKg,
      };
    }
    if (!garmentPriced) {
      if (pricingMode !== BranchPricingMode.FLAT_BAG) {
        const rates = pricingRates ?? {};
        if (pricingMode === BranchPricingMode.PER_KG && rates.basePricePerKg == null) {
          throw new BadRequestException('This shop has not configured per-kg pricing for this service');
        }
        if (pricingMode === BranchPricingMode.PER_LOAD && rates.basePricePerLoad == null) {
          throw new BadRequestException('This shop has not configured per-load pricing for this service');
        }
        if (pricingMode === BranchPricingMode.PER_PIECE && rates.basePricePerPiece == null) {
          throw new BadRequestException('This shop has not configured per-piece pricing for this service');
        }
        if (pricingMode === BranchPricingMode.PER_PAIR && rates.basePricePerPair == null) {
          throw new BadRequestException('This shop has not configured per-pair pricing for this service');
        }
        if (pricingMode === BranchPricingMode.PER_ITEM && rates.basePricePerItem == null) {
          throw new BadRequestException('This shop has not configured per-item pricing for this service');
        }
        if (pricingMode === BranchPricingMode.FIXED && rates.fixedPrice == null) {
          throw new BadRequestException('This shop has not configured a fixed price for this service');
        }
        if (pricingMode === BranchPricingMode.PER_KG && !service.enteredWeightKg) {
          throw new BadRequestException('Enter the estimated weight for this shop\'s per-kg pricing');
        }
        if (pricingMode === BranchPricingMode.PER_KG && service.enteredWeightKg != null) {
          if (service.enteredWeightKg < BOOKING_MIN_WEIGHT_KG) {
            throw new BadRequestException(`Minimum booking weight is ${BOOKING_MIN_WEIGHT_KG} kg`);
          }
          if (service.enteredWeightKg > BOOKING_PER_KG_MAX_KG) {
            throw new BadRequestException(
              `Per-kg pricing only covers up to ${BOOKING_PER_KG_MAX_KG} kg — heavier loads are billed per machine load`,
            );
          }
        }
        if (pricingMode === BranchPricingMode.PER_LOAD && !service.enteredWeightKg && !service.enteredLoadCount) {
          throw new BadRequestException('Enter the estimated weight or load count for this shop\'s per-load pricing');
        }
        if (
          pricingMode === BranchPricingMode.PER_LOAD &&
          service.enteredWeightKg != null &&
          service.enteredWeightKg < BOOKING_MIN_WEIGHT_KG
        ) {
          throw new BadRequestException(`Minimum booking weight is ${BOOKING_MIN_WEIGHT_KG} kg`);
        }
        if (pricingMode === BranchPricingMode.PER_PIECE && !service.enteredPieceCount) {
          throw new BadRequestException('Enter the piece count for this shop\'s per-piece pricing');
        }
        if (pricingMode === BranchPricingMode.PER_PAIR && !service.enteredPieceCount) {
          throw new BadRequestException('Enter the pair count for this shop\'s per-pair pricing');
        }
        if (pricingMode === BranchPricingMode.PER_ITEM && !service.enteredPieceCount) {
          throw new BadRequestException('Enter the item count for this shop\'s per-item pricing');
        }
      } else if (!service.bagSizeId) {
        throw new BadRequestException('Choose a bag size for this shop');
      }
    }
    const offered = await this.branchesService.isServiceTypeOfferedByBranch(branch, service.bookingType);
    if (!offered) {
      throw new BadRequestException('This shop does not offer this service');
    }
    // Only label/description come from the shop's own catalog now — base price is flat bag
    // pricing (BAG_SIZES), same regardless of booking type or which shop is assigned.
    const resolved = await this.branchesService.resolvePriceableService(
      branch,
      service.bookingType,
      service.customServiceId,
    );
    const priceableService = {
      ...catalogService,
      label: resolved.label ?? catalogService.label,
      description: resolved.description ?? catalogService.description,
    };

    return calculateQuote(
      {
        bookingType: service.bookingType,
        bagSizeId: service.bagSizeId as BagSizeId,
        addonIds: [],
        pricingMode,
        rates: pricingRates,
        enteredWeightKg: service.enteredWeightKg,
        enteredLoadCount: service.enteredLoadCount,
        enteredPieceCount: service.enteredPieceCount,
        garmentSelections: service.garmentSelections as GarmentSelection[] | undefined,
        kgPerLoad: branch.kgPerLoad ?? BOOKING_MACHINE_LOAD_MIN_KG,
      },
      priceableService,
      [],
      0,
      branchGarmentCatalog,
    );
  }

  /**
   * White-labeled partner bookings (partnerContextId set) are scoped to that partner's own
   * branch pool instead of a customer-chosen branchId, but otherwise resolve a branch and price
   * against it exactly like the general customer flow — including that branch's pricing mode.
   * Every selected service is priced independently (each keeping its own pricing mode/inputs)
   * against the one resolved branch, then combined into a single order-level breakdown.
   */
  async buildQuote(
    dto: BookingQuoteDto,
    areaServices: BookingType[],
    userId: string,
    address: { city: string; province: string; latitude?: number; longitude?: number },
    partnerContextId?: string,
  ) {
    if (!dto.services?.length) {
      throw new BadRequestException('Select at least one service');
    }
    for (const service of dto.services) {
      if (!isServiceAvailableInArea(service.bookingType, areaServices)) {
        throw new BadRequestException('This service is not available in your area');
      }
    }

    const bookingTypes = dto.services.map((s) => s.bookingType);
    const primary = dto.services[0];
    const bag = primary.bagSizeId ? getBagSize(primary.bagSizeId) : undefined;
    const estimatedWeight = bag?.capacityKg ?? primary.enteredWeightKg ?? 5;

    let branchId: string;
    if (partnerContextId) {
      // White-labeled bookings stay within that partner's own branch pool — no customer choice.
      const partnerBranch = await this.resolvePartnerBranch(
        partnerContextId,
        address,
        bookingTypes,
        estimatedWeight,
        dto,
      );
      branchId = partnerBranch.branchId;
    } else {
      branchId = dto.branchId ?? '';
      if (!branchId) {
        // "Let Lunara dispatch" — customer didn't pick a shop, so pick the top-ranked
        // available branch network-wide instead of blocking checkout.
        branchId = await this.resolveNetworkBranch(address, bookingTypes, estimatedWeight, dto);
      }
    }

    const branch = await this.branchesService.getActivePartnerShop(branchId);
    const resolvedBranchId = branch._id.toString();

    const [branchLng, branchLat] = branch.location.coordinates;
    const customerCoords = resolveCoordinates(address.city, address.latitude, address.longitude);
    const dist = distanceKm(customerCoords, [branchLng, branchLat]);
    const maxDeliveryRadiusKm = await this.settingsService.getMaxDeliveryRadiusKm();
    if (dist > maxDeliveryRadiusKm) {
      throw new BadRequestException(
        `Selected shop does not deliver to this address (${dist.toFixed(1)}km exceeds the ${maxDeliveryRadiusKm}km delivery limit)`,
      );
    }
    // Beyond the shop's own service radius but still within the platform-wide ceiling — let the
    // order through but hold it for manual admin approval instead of auto-dispatching it.
    const requiresDeliveryApproval = dist > branch.serviceRadiusKm;

    const serviceQuotes: QuoteBreakdown[] = [];
    for (const service of dto.services) {
      serviceQuotes.push(await this.priceOneService(service, branch));
    }

    let priceableAddons: Awaited<ReturnType<CatalogService['listActiveAddons']>> =
      await this.branchesService.listPriceableAddonOptions(branch);
    priceableAddons = await Promise.all(
      priceableAddons.map(async (addon) => {
        // Percent-of-service add-ons bill off the order's own combined service subtotal,
        // computed later in combineServiceQuotes — no shop rate to resolve or markup here.
        if (addon.isPercentOfService) return addon;
        const unit = this.branchesService.resolveAddonPricingUnit(branch, addon.id);
        const rate = await this.branchesService.resolveAddonRateForUnit(branch, addon.id, unit);
        return { ...addon, price: applyShopMarkup(rate), pricingUnit: unit };
      }),
    );

    const addonIds = dto.addonIds ?? [];
    const invalidAddon = addonIds.find((id) => !priceableAddons.some((a) => a.id === id));
    if (invalidAddon) {
      throw new BadRequestException('Invalid or inactive add-on');
    }
    // Percent-of-service add-ons (Express/Same-Day) are order-level, not scoped to any specific
    // service — they're always applicable regardless of the (possibly empty) applicableServiceTypes.
    const inapplicableAddon = addonIds.find((id) => {
      const addon = priceableAddons.find((a) => a.id === id);
      return (
        !addon?.isPercentOfService &&
        !addon?.applicableServiceTypes?.some((t) => bookingTypes.includes(t))
      );
    });
    if (inapplicableAddon) {
      throw new BadRequestException('That add-on is not available for the selected service');
    }
    if (
      addonIds.includes(EXPRESS_RETURN_ADDON_ID) &&
      !isExpressReturnAllowed(dto.scheduledPickupAt)
    ) {
      throw new BadRequestException(
        'Express return is not available for pickups starting at 3:00 PM or later',
      );
    }

    const addonQuantities = dto.addonQuantities ?? {};
    for (const [addonId, qty] of Object.entries(addonQuantities)) {
      if (!addonIds.includes(addonId)) {
        throw new BadRequestException('addonQuantities can only be set for selected add-ons');
      }
      const addon = priceableAddons.find((a) => a.id === addonId);
      if (!addon?.allowsQuantity) {
        throw new BadRequestException(`Add-on "${addonId}" does not support a quantity`);
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > (addon.maxQuantity ?? 5)) {
        throw new BadRequestException(`Invalid quantity for add-on "${addonId}"`);
      }
    }

    const deliveryFee = await this.settingsService.getDeliveryFeeForAddress(address, dist);
    const quote = combineServiceQuotes(
      serviceQuotes,
      priceableAddons,
      addonIds,
      deliveryFee,
      branch.kgPerLoad ?? BOOKING_MACHINE_LOAD_MIN_KG,
      addonQuantities,
    );

    if (!quote.meetsMinimum) {
      throw new BadRequestException(
        `Minimum order is ₱${BOOKING_MIN_ORDER_AMOUNT}. Choose a larger bag or add add-ons to continue.`,
      );
    }

    const finalQuote = await this.promotionsService.applyCouponToQuote(
      quote,
      dto.couponCode,
      userId,
      branch.partnerUserId.toString(),
    );
    // Back-compat: mirror the primary (first) service's single-service fields at the top level
    // (bookingType, serviceLabel, bagLabel, ...) alongside the new `services[]`/combined totals,
    // so existing single-service UI keeps working unchanged while multi-service UI can read `services`.
    const primaryServiceQuote = serviceQuotes[0];
    return {
      ...primaryServiceQuote,
      ...finalQuote,
      resolvedBranchId,
      deliveryDistanceKm: dist,
      requiresDeliveryApproval,
    };
  }

  async quote(userId: string, addressId: string, dto: BookingQuoteDto, partnerContextId?: string) {
    const { address, area } = await this.validateAddressForUser(userId, addressId);
    const breakdown = await this.buildQuote(dto, area.availableServices, userId, address, partnerContextId);
    return { success: true, data: breakdown };
  }

  async prepareOrderPayload(
    userId: string,
    dto: CreateBookingOrderDto,
    partnerContextId?: string,
  ) {
    const { address, area } = await this.validateAddressForUser(userId, dto.pickupAddressId);
    const quote = await this.buildQuote(dto, area.availableServices, userId, address, partnerContextId);
    const pickupCheck = await this.branchesService.validatePickupTimeForBranch(
      quote.resolvedBranchId,
      dto.scheduledPickupAt,
    );
    if (!pickupCheck.valid) {
      throw new BadRequestException(pickupCheck.message ?? 'Selected pickup time is not available');
    }

    const serviceNoteFor = (serviceQuote: (typeof quote.services)[number]) =>
      serviceQuote.garmentSelections?.length
        ? serviceQuote.garmentSelections
            .map((g) => `${GARMENT_CATALOG.find((c) => c.id === g.garmentId)?.label ?? g.garmentId} ×${g.quantity}`)
            .join(', ')
        : serviceQuote.pricingMode === BranchPricingMode.FLAT_BAG
          ? `${serviceQuote.bagLabel} bag (up to ${serviceQuote.weightKg} kg)`
          : serviceQuote.pricingMode === BranchPricingMode.FIXED
            ? 'Fixed price'
            : serviceQuote.pricingMode === BranchPricingMode.PER_PIECE
              ? `${serviceQuote.pieceCount ?? 0} pieces (estimated)`
              : serviceQuote.pricingMode === BranchPricingMode.PER_PAIR
                ? `${serviceQuote.pieceCount ?? 0} pairs (estimated)`
                : serviceQuote.pricingMode === BranchPricingMode.PER_ITEM
                  ? `${serviceQuote.pieceCount ?? 0} items (estimated)`
                  : `${serviceQuote.weightKg} kg (estimated)`;

    const items = [
      ...quote.services.map((serviceQuote) => ({
        serviceType: serviceQuote.bookingType,
        quantity: 1,
        unitPrice: serviceQuote.serviceSubtotal,
        notes: serviceNoteFor(serviceQuote),
      })),
      ...quote.addons.map((a) => ({
        // Add-ons are priced once at the order level (not per service) — tag them against the
        // primary (first) service type since OrderItem has no order-level "addon" slot of its own.
        serviceType: quote.services[0].bookingType,
        quantity: 1,
        unitPrice: a.price,
        notes: a.percent
          ? `Add-on: ${a.label} (+${a.percent}%)`
          : a.unit && a.unit !== BranchPricingMode.FLAT_BAG && a.unit !== BranchPricingMode.FIXED
            ? `Add-on: ${a.label} (×${a.quantity ?? 0} ${
                a.unit === BranchPricingMode.PER_KG
                  ? 'kg'
                  : a.unit === BranchPricingMode.PER_LOAD
                    ? 'loads'
                    : a.unit === BranchPricingMode.PER_PAIR
                      ? 'pairs'
                      : a.unit === BranchPricingMode.PER_ITEM
                        ? 'items'
                        : 'pieces'
              })`
            : a.addonQuantity && a.addonQuantity > 1
              ? `Add-on: ${a.label} (×${a.addonQuantity})`
              : `Add-on: ${a.label}`,
      })),
    ];

    // buildQuote() above already resolved the branch for both flows — the customer-picked or
    // network-dispatched shop for the general flow, or the top-ranked shop within that partner's
    // own pool for white-labeled bookings. Payout accounting is identical either way.
    const branch = await this.branchesService.getActivePartnerShop(quote.resolvedBranchId!);
    // Bag pricing is flat and platform-wide — the partner's payout share of the service
    // portion is the branch's own commissionRate. Add-ons keep their existing shop-markup split —
    // reverse the markup off the already quantity-correct customer price rather than recomputing
    // rate × quantity a second time here.
    const baseAddonsSum = quote.addons.reduce((sum, a) => sum + a.price / SHOP_PRICE_MARKUP_MULTIPLIER, 0);
    const serviceBaseSubtotal = Math.round(quote.serviceSubtotal * (1 - branch.commissionRate));
    const branchId = branch._id.toString();
    const branchCode = branch.code;
    const branchName = branch.name;
    const resolvedPartnerId = branch.partnerUserId.toString();
    const baseSubtotal = Math.round(serviceBaseSubtotal + baseAddonsSum);
    const pricingModel = 'commission' as const;

    // Order-level bookingType/pricingMode/estimate fields still describe a single service for
    // anything downstream that hasn't been migrated to itemized services — the primary (first)
    // selected service. The itemized `items[]` above is the source of truth for what was booked.
    const primaryDto = dto.services[0];
    const primaryQuote = quote.services[0];
    let pricingSnapshot:
      | {
          basePricePerKg?: number;
          basePricePerLoad?: number;
          basePricePerPiece?: number;
          basePricePerPair?: number;
          basePricePerItem?: number;
          fixedPrice?: number;
          minWeightKg?: number;
        }
      | undefined;
    if (primaryQuote.pricingMode !== BranchPricingMode.FLAT_BAG) {
      const servicePrice = branch.servicePricing?.find((p) => p.serviceType === primaryDto.bookingType);
      // Mark up every rate the same way priceOneService does — this snapshot is what shop-receiving
      // later re-prices from once the actual weight/load/piece count is confirmed, so it must carry
      // the customer-facing (marked-up) rate, not the partner's raw one.
      pricingSnapshot = {
        basePricePerKg: servicePrice?.basePricePerKg != null ? applyShopMarkup(servicePrice.basePricePerKg) : undefined,
        basePricePerLoad: servicePrice?.basePricePerLoad != null ? applyShopMarkup(servicePrice.basePricePerLoad) : undefined,
        basePricePerPiece: servicePrice?.basePricePerPiece != null ? applyShopMarkup(servicePrice.basePricePerPiece) : undefined,
        basePricePerPair: servicePrice?.basePricePerPair != null ? applyShopMarkup(servicePrice.basePricePerPair) : undefined,
        basePricePerItem: servicePrice?.basePricePerItem != null ? applyShopMarkup(servicePrice.basePricePerItem) : undefined,
        fixedPrice: servicePrice?.fixedPrice != null ? applyShopMarkup(servicePrice.fixedPrice) : undefined,
      };
    }

    return {
        bookingType: primaryDto.bookingType,
        items,
        pickupAddressId: dto.pickupAddressId,
        deliveryAddressId: dto.deliveryAddressId ?? dto.pickupAddressId,
        customerNotes: dto.customerNotes,
        scheduledPickupAt: dto.scheduledPickupAt,
        scheduledDeliveryAt: undefined,
        couponCode: quote.couponCode,
        estimatedWeightKg: primaryQuote.weightKg,
        estimatedLoadCount: primaryDto.enteredLoadCount,
        estimatedPieceCount: primaryDto.enteredPieceCount,
        garmentSelections: primaryQuote.garmentSelections,
        bagSizeId: primaryQuote.bagSizeId,
        bagSizeLabel: primaryQuote.bagLabel,
        addons: quote.addons.map((a) => ({
          id: a.id,
          label: a.label,
          price: a.price,
          quantity: a.addonQuantity,
        })),
        subtotal: quote.subtotal,
        deliveryFee: quote.deliveryFee,
        discount: quote.discount,
        discountFundedBy: quote.discount > 0 ? quote.fundedBy : undefined,
        total: quote.total,
        pricingMode: primaryQuote.pricingMode,
        pricingSnapshot,
        isEstimate: quote.isEstimate,
        branchId,
        branchCode,
        branchName,
        partnerId: resolvedPartnerId,
        baseSubtotal,
        pricingModel,
        deliveryDistanceKm: quote.deliveryDistanceKm,
        requiresDeliveryApproval: quote.requiresDeliveryApproval,
    };
  }

  /**
   * Auto-dispatch ("Let Lunara pick") flows never show the customer a mode-specific weight/load/
   * piece input — that UI only appears once a specific shop is chosen — so dispatch must not hand
   * an auto-picked order to a non-FLAT_BAG branch unless the customer already supplied the input
   * that mode needs. Finds the first eligible, qualified branch whose pricing this dto can price.
   */
  private async firstDispatchableBranch(
    branchEvaluations: { branchId: string; code: string; name: string; availability: { acceptingOrders: boolean }; qualified: boolean }[],
    dto: BookingQuoteDto,
    bookingTypes: BookingType[],
  ) {
    for (const candidate of branchEvaluations) {
      if (!candidate.availability.acceptingOrders || !candidate.qualified) continue;
      const branch = await this.branchesService.getActivePartnerShop(candidate.branchId);

      const offersAll = await Promise.all(
        bookingTypes.map((type) => this.branchesService.isServiceTypeOfferedByBranch(branch, type)),
      );
      if (offersAll.some((offered) => !offered)) continue;

      const canPriceEveryService = dto.services.every((service) => {
        if (this.branchesService.resolveServicePricingUnit(branch, service.bookingType) === BranchPricingMode.FLAT_BAG) {
          return true;
        }
        return Boolean(service.enteredWeightKg || service.enteredLoadCount || service.enteredPieceCount);
      });
      if (canPriceEveryService) return candidate;
    }
    return undefined;
  }

  /**
   * Picks the best of this partner's own branches for a white-labeled booking. Per product
   * decision, a partner-branded booking always stays with that partner — if none of their
   * branches can accept it, checkout is blocked rather than falling back to admin dispatch.
   */
  private async resolvePartnerBranch(
    partnerContextId: string,
    address: { line1?: string; city: string; province: string; latitude?: number; longitude?: number },
    bookingTypes: BookingType[],
    estimatedWeightKg: number,
    dto: BookingQuoteDto,
  ) {
    const evaluation = await this.branchesService.buildDispatchEvaluationsForPartner(
      // `address` here is usually a live Mongoose document (schema fields are getters, not own
      // enumerable properties) — `{ ...address }` silently drops city/province/etc., so pick each
      // field explicitly instead of spreading.
      {
        line1: address.line1 ?? '',
        city: address.city,
        province: address.province,
        latitude: address.latitude,
        longitude: address.longitude,
      },
      bookingTypes[0],
      estimatedWeightKg,
      new Types.ObjectId(partnerContextId),
    );

    // Lunara is choosing on the customer's behalf here, so only algorithmically-qualified
    // branches are eligible — capacity alone isn't enough (see isQualityQualified).
    const eligible = await this.firstDispatchableBranch(evaluation.branchEvaluations, dto, bookingTypes);
    if (!eligible) {
      throw new BadRequestException(
        'This laundry partner is fully booked right now. Please try again later.',
      );
    }

    return { branchId: eligible.branchId, code: eligible.code, name: eligible.name };
  }

  /**
   * "Let Lunara dispatch" — for the general customer flow, picks the top-ranked available
   * branch across the whole network (not scoped to one partner) instead of requiring the
   * customer to pick a specific shop. Mirrors resolvePartnerBranch, but network-wide.
   */
  private async resolveNetworkBranch(
    address: { line1?: string; city: string; province: string; latitude?: number; longitude?: number },
    bookingTypes: BookingType[],
    estimatedWeightKg: number,
    dto: BookingQuoteDto,
  ) {
    const evaluation = await this.branchesService.buildDispatchEvaluations(
      // Same Mongoose-document-spread pitfall as resolvePartnerBranch above — pick fields explicitly.
      {
        line1: address.line1 ?? '',
        city: address.city,
        province: address.province,
        latitude: address.latitude,
        longitude: address.longitude,
      },
      bookingTypes[0],
      estimatedWeightKg,
    );

    // Lunara is choosing the shop here, not the customer, so it must meet the quality bar too.
    const eligible = await this.firstDispatchableBranch(evaluation.branchEvaluations, dto, bookingTypes);
    if (!eligible) {
      throw new BadRequestException(
        'All nearby laundry shops are fully booked right now. Please try again later.',
      );
    }

    return eligible.branchId;
  }
}
