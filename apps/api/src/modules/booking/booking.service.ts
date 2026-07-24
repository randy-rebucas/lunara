import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingType } from '@lunara/types';
import {
  applyShopMarkup,
  BAG_SIZES,
  BOOKING_MIN_ORDER_AMOUNT,
  BranchPricingMode,
  calculateQuote,
  type BagSizeId,
  distanceKm,
  EXPRESS_RETURN_ADDON_ID,
  getBagSize,
  generatePickupSlots,
  isExpressReturnAllowed,
  isPickupSlotBookable,
  PICKUP_SCHEDULE_DAY_COUNT,
  isServiceAvailableInArea,
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
import { BookingQuoteDto, CreateBookingOrderDto } from './dto/booking.dto';

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
      },
    };
  }

  /** Nearby partner shops with their marked-up prices, for the customer's shop-selection step. */
  async getShopOptions(userId: string, addressId: string) {
    return this.branchesService.findNearbyShopsForAddressId(userId, addressId);
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

  /** Once a shop is chosen (customer-picked or Lunara-dispatched), pickup slots must reflect
   * that shop's own hours and holidays (stricter and authoritative); otherwise fall back to the
   * union of every active branch's hours, with no holiday filtering (white-labeled / not-yet-chosen
   * flow — no single shop's holiday calendar applies yet). Shared by getAvailability (schedule step)
   * and prepareOrderPayload (submission) so both agree on what's bookable. */
  private async resolveSchedule(branchId?: string) {
    if (!branchId) {
      return { operatingHours: await this.branchesService.getUnionOperatingHours(), holidays: [] };
    }
    const branch = await this.branchesService.getActivePartnerShop(branchId);
    const holidays = await this.branchesService.resolveBranchHolidays(branch);
    return { operatingHours: branch.operatingHours, holidays };
  }

  async getAvailability(userId: string, addressId: string, branchId?: string) {
    const { area } = await this.validateAddressForUser(userId, addressId);
    const { operatingHours, holidays } = await this.resolveSchedule(branchId);
    const slots = generatePickupSlots(new Date(), PICKUP_SCHEDULE_DAY_COUNT, operatingHours, holidays);
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
        slots,
        holidays,
        partnerCoverage,
        dispatchNote: 'Next, choose which laundry shop you\'d like to book with.',
      },
    };
  }

  /**
   * White-labeled partner bookings (partnerContextId set) are scoped to that partner's own
   * branch pool instead of a customer-chosen branchId, but otherwise resolve a branch and price
   * against it exactly like the general customer flow — including that branch's pricing mode.
   */
  async buildQuote(
    dto: BookingQuoteDto,
    areaServices: BookingType[],
    userId: string,
    address: { city: string; province: string; latitude?: number; longitude?: number },
    partnerContextId?: string,
  ) {
    const service = await this.catalogService.findActiveByType(dto.bookingType);
    if (!service) throw new BadRequestException('Invalid or inactive service type');
    if (!isServiceAvailableInArea(dto.bookingType, areaServices)) {
      throw new BadRequestException('This service is not available in your area');
    }

    let priceableService = service;
    let priceableAddons = await this.catalogService.listActiveAddons();
    let resolvedBranchId: string | undefined;
    let pricingMode: BranchPricingMode = BranchPricingMode.FLAT_BAG;
    let pricingRates:
      | { basePricePerKg?: number; basePricePerLoad?: number; basePricePerPiece?: number; minWeightKg?: number }
      | undefined;
    {
      const bag = dto.bagSizeId ? getBagSize(dto.bagSizeId) : undefined;
      const estimatedWeight = bag?.capacityKg ?? dto.enteredWeightKg ?? 5;

      let branchId: string;
      if (partnerContextId) {
        // White-labeled bookings stay within that partner's own branch pool — no customer choice.
        const partnerBranch = await this.resolvePartnerBranch(
          partnerContextId,
          address,
          dto.bookingType,
          estimatedWeight,
          dto,
        );
        branchId = partnerBranch.branchId;
      } else {
        branchId = dto.branchId ?? '';
        if (!branchId) {
          // "Let Lunara dispatch" — customer didn't pick a shop, so pick the top-ranked
          // available branch network-wide instead of blocking checkout.
          branchId = await this.resolveNetworkBranch(address, dto.bookingType, estimatedWeight, dto);
        }
      }

      const branch = await this.branchesService.getActivePartnerShop(branchId);
      resolvedBranchId = branch._id.toString();
      pricingMode = this.branchesService.resolveServicePricingUnit(branch, dto.bookingType);
      if (pricingMode !== BranchPricingMode.FLAT_BAG) {
        const servicePrice = branch.servicePricing?.find((p) => p.serviceType === dto.bookingType);
        pricingRates = {
          basePricePerKg: servicePrice?.basePricePerKg,
          basePricePerLoad: servicePrice?.basePricePerLoad,
          basePricePerPiece: servicePrice?.basePricePerPiece,
        };
        if (pricingMode === BranchPricingMode.PER_KG && pricingRates.basePricePerKg == null) {
          throw new BadRequestException('This shop has not configured per-kg pricing for this service');
        }
        if (pricingMode === BranchPricingMode.PER_LOAD && pricingRates.basePricePerLoad == null) {
          throw new BadRequestException('This shop has not configured per-load pricing for this service');
        }
        if (pricingMode === BranchPricingMode.PER_PIECE && pricingRates.basePricePerPiece == null) {
          throw new BadRequestException('This shop has not configured per-piece pricing for this service');
        }
        if (pricingMode === BranchPricingMode.PER_KG && !dto.enteredWeightKg) {
          throw new BadRequestException('Enter the estimated weight for this shop\'s per-kg pricing');
        }
        if (pricingMode === BranchPricingMode.PER_LOAD && !dto.enteredWeightKg && !dto.enteredLoadCount) {
          throw new BadRequestException('Enter the estimated weight or load count for this shop\'s per-load pricing');
        }
        if (pricingMode === BranchPricingMode.PER_PIECE && !dto.enteredPieceCount) {
          throw new BadRequestException('Enter the piece count for this shop\'s per-piece pricing');
        }
      } else if (!dto.bagSizeId) {
        throw new BadRequestException('Choose a bag size for this shop');
      }
      const [branchLng, branchLat] = branch.location.coordinates;
      const customerCoords = resolveCoordinates(address.city, address.latitude, address.longitude);
      const dist = distanceKm(customerCoords, [branchLng, branchLat]);
      if (dist > branch.serviceRadiusKm) {
        throw new BadRequestException('Selected shop does not deliver to this address');
      }
      const offered = await this.branchesService.isServiceTypeOfferedByBranch(
        branch,
        dto.bookingType,
      );
      if (!offered) {
        throw new BadRequestException('This shop does not offer this service');
      }
      // Only label/description come from the shop's own catalog now — base price is flat bag
      // pricing (BAG_SIZES), same regardless of booking type or which shop is assigned.
      const resolved = await this.branchesService.resolvePriceableService(
        branch,
        dto.bookingType,
        dto.customServiceId,
      );
      priceableService = {
        ...service,
        label: resolved.label ?? service.label,
        description: resolved.description ?? service.description,
      };
      priceableAddons = await this.branchesService.listPriceableAddonOptions(branch);
      priceableAddons = await Promise.all(
        priceableAddons.map(async (addon) => {
          const unit = this.branchesService.resolveAddonPricingUnit(branch, addon.id);
          const rate = await this.branchesService.resolveAddonRateForUnit(branch, addon.id, unit);
          return { ...addon, price: applyShopMarkup(rate), pricingUnit: unit };
        }),
      );
    }

    const addonIds = dto.addonIds ?? [];
    const invalidAddon = addonIds.find((id) => !priceableAddons.some((a) => a.id === id));
    if (invalidAddon) {
      throw new BadRequestException('Invalid or inactive add-on');
    }
    if (
      addonIds.includes(EXPRESS_RETURN_ADDON_ID) &&
      !isExpressReturnAllowed(dto.scheduledPickupAt)
    ) {
      throw new BadRequestException(
        'Express return is not available for pickups starting at 3:00 PM or later',
      );
    }

    const deliveryFee = await this.settingsService.getDeliveryFeeForAddress(address);

    const quote = calculateQuote(
      {
        bookingType: dto.bookingType,
        bagSizeId: dto.bagSizeId as BagSizeId,
        addonIds,
        pricingMode,
        rates: pricingRates,
        enteredWeightKg: dto.enteredWeightKg,
        enteredLoadCount: dto.enteredLoadCount,
        enteredPieceCount: dto.enteredPieceCount,
      },
      priceableService,
      priceableAddons,
      deliveryFee,
    );

    if (!quote.meetsMinimum) {
      throw new BadRequestException(
        `Minimum order is ₱${BOOKING_MIN_ORDER_AMOUNT}. Choose a larger bag or add add-ons to continue.`,
      );
    }

    const finalQuote = await this.promotionsService.applyCouponToQuote(quote, dto.couponCode, userId);
    return { ...finalQuote, resolvedBranchId };
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
    const { operatingHours, holidays } = await this.resolveSchedule(quote.resolvedBranchId);
    const slot = generatePickupSlots(
      new Date(),
      PICKUP_SCHEDULE_DAY_COUNT,
      operatingHours,
      holidays,
    ).find((s) => s.startAt === dto.scheduledPickupAt);
    if (!slot || !isPickupSlotBookable(slot)) {
      throw new BadRequestException('Selected pickup slot is no longer available');
    }

    const serviceNote =
      quote.pricingMode === BranchPricingMode.FLAT_BAG
        ? `${quote.bagLabel} bag (up to ${quote.weightKg} kg)`
        : quote.pricingMode === BranchPricingMode.PER_PIECE
          ? `${quote.pieceCount ?? dto.enteredPieceCount ?? 0} pieces (estimated)`
          : `${quote.weightKg} kg (estimated)`;
    const items = [
      {
        serviceType: dto.bookingType,
        quantity: 1,
        unitPrice: quote.serviceSubtotal,
        notes: serviceNote,
      },
      ...quote.addons.map((a) => ({
        serviceType: dto.bookingType,
        quantity: 1,
        unitPrice: a.price,
        notes:
          a.unit && a.unit !== BranchPricingMode.FLAT_BAG
            ? `Add-on: ${a.label} (×${a.quantity ?? 0} ${a.unit === BranchPricingMode.PER_KG ? 'kg' : a.unit === BranchPricingMode.PER_LOAD ? 'loads' : 'pieces'})`
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
    let pricingSnapshot:
      | { basePricePerKg?: number; basePricePerLoad?: number; basePricePerPiece?: number; minWeightKg?: number }
      | undefined;
    if (quote.pricingMode !== BranchPricingMode.FLAT_BAG) {
      const servicePrice = branch.servicePricing?.find((p) => p.serviceType === dto.bookingType);
      pricingSnapshot = {
        basePricePerKg: servicePrice?.basePricePerKg,
        basePricePerLoad: servicePrice?.basePricePerLoad,
        basePricePerPiece: servicePrice?.basePricePerPiece,
      };
    }

    return {
        bookingType: dto.bookingType,
        items,
        pickupAddressId: dto.pickupAddressId,
        deliveryAddressId: dto.deliveryAddressId ?? dto.pickupAddressId,
        scheduledPickupAt: dto.scheduledPickupAt,
        scheduledDeliveryAt: undefined,
        couponCode: quote.couponCode,
        estimatedWeightKg: quote.weightKg,
        estimatedLoadCount: dto.enteredLoadCount,
        estimatedPieceCount: dto.enteredPieceCount,
        bagSizeId: quote.bagSizeId,
        bagSizeLabel: quote.bagLabel,
        addons: quote.addons,
        subtotal: quote.subtotal,
        deliveryFee: quote.deliveryFee,
        discount: quote.discount,
        total: quote.total,
        pricingMode: quote.pricingMode,
        pricingSnapshot,
        isEstimate: quote.isEstimate,
        branchId,
        branchCode,
        branchName,
        partnerId: resolvedPartnerId,
        baseSubtotal,
        pricingModel,
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
    bookingType: BookingType,
  ) {
    const canPriceNonFlat = Boolean(dto.enteredWeightKg || dto.enteredLoadCount || dto.enteredPieceCount);
    for (const candidate of branchEvaluations) {
      if (!candidate.availability.acceptingOrders || !candidate.qualified) continue;
      if (canPriceNonFlat) return candidate;
      const branch = await this.branchesService.getActivePartnerShop(candidate.branchId);
      if (this.branchesService.resolveServicePricingUnit(branch, bookingType) === BranchPricingMode.FLAT_BAG) {
        return candidate;
      }
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
    bookingType: BookingType,
    estimatedWeightKg: number,
    dto: BookingQuoteDto,
  ) {
    const evaluation = await this.branchesService.buildDispatchEvaluationsForPartner(
      { ...address, line1: address.line1 ?? '' },
      bookingType,
      estimatedWeightKg,
      new Types.ObjectId(partnerContextId),
    );

    // Lunara is choosing on the customer's behalf here, so only algorithmically-qualified
    // branches are eligible — capacity alone isn't enough (see isQualityQualified).
    const eligible = await this.firstDispatchableBranch(evaluation.branchEvaluations, dto, bookingType);
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
    bookingType: BookingType,
    estimatedWeightKg: number,
    dto: BookingQuoteDto,
  ) {
    const evaluation = await this.branchesService.buildDispatchEvaluations(
      { ...address, line1: address.line1 ?? '' },
      bookingType,
      estimatedWeightKg,
    );

    // Lunara is choosing the shop here, not the customer, so it must meet the quality bar too.
    const eligible = await this.firstDispatchableBranch(evaluation.branchEvaluations, dto, bookingType);
    if (!eligible) {
      throw new BadRequestException(
        'All nearby laundry shops are fully booked right now. Please try again later.',
      );
    }

    return eligible.branchId;
  }
}
