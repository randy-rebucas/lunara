import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingType } from '@lunara/types';
import {
  applyShopMarkup,
  BOOKING_MAX_WEIGHT_KG,
  BOOKING_MIN_ORDER_AMOUNT,
  BOOKING_MIN_WEIGHT_KG,
  calculateQuote,
  distanceKm,
  EXPRESS_RETURN_ADDON_ID,
  generatePickupSlots,
  isExpressReturnAllowed,
  isPickupSlotBookable,
  PICKUP_SCHEDULE_DAY_COUNT,
  isServiceAvailableInArea,
  resolveCoordinates,
  SERVICE_AREAS,
  validateAddressFields,
  validateServiceArea,
} from '@lunara/utils';
import { AddressesService } from '../addresses/addresses.service';
import { BranchesService } from '../branches/branches.service';
import { CatalogService } from '../catalog/catalog.service';
import { PromotionsService } from '../promotions/promotions.service';
import { SettingsService } from '../settings/settings.service';
import { BookingQuoteDto, CreateBookingOrderDto } from './dto/booking.dto';

@Injectable()
export class BookingService {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly branchesService: BranchesService,
    private readonly catalogService: CatalogService,
    private readonly promotionsService: PromotionsService,
    private readonly settingsService: SettingsService,
  ) {}

  async getConfig() {
    const [services, addons, deliveryFees] = await Promise.all([
      this.catalogService.listActiveServices(),
      this.catalogService.listActiveAddons(),
      this.settingsService.getDeliveryFeeSettings(),
    ]);
    return {
      success: true,
      data: {
        services,
        addons,
        serviceAreas: SERVICE_AREAS.map((a) => ({
          id: a.id,
          label: a.label,
          cities: a.cities,
        })),
        minOrderAmount: BOOKING_MIN_ORDER_AMOUNT,
        minWeightKg: BOOKING_MIN_WEIGHT_KG,
        maxWeightKg: BOOKING_MAX_WEIGHT_KG,
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

    // The curated SERVICE_AREAS list gives nicer labels and (for Metro Manila) restricts
    // which service types are offered. But it's a manually maintained whitelist that doesn't
    // scale as new partners onboard in new cities — so it's an enrichment, not the sole gate.
    // The real gate is whether any active branch (across all partners) actually covers this
    // address within its service radius.
    const curatedArea = validateServiceArea(fields);

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

  async getAvailability(userId: string, addressId: string) {
    const { area } = await this.validateAddressForUser(userId, addressId);
    const slots = generatePickupSlots(new Date(), PICKUP_SCHEDULE_DAY_COUNT);
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
        partnerCoverage,
        dispatchNote: 'Next, choose which laundry shop you\'d like to book with.',
      },
    };
  }

  /**
   * White-labeled partner bookings never have a customer-chosen branchId, so they keep using
   * plain global catalog pricing (see F4 — shop markup is scoped to the general customer flow).
   */
  async buildQuote(
    dto: BookingQuoteDto,
    areaServices: BookingType[],
    userId: string,
    address: { city: string; province: string; latitude?: number; longitude?: number },
    isWhiteLabel = false,
  ) {
    const service = await this.catalogService.findActiveByType(dto.bookingType);
    if (!service) throw new BadRequestException('Invalid or inactive service type');
    if (!isServiceAvailableInArea(dto.bookingType, areaServices)) {
      throw new BadRequestException('This service is not available in your area');
    }

    let priceableService = service;
    if (!isWhiteLabel) {
      if (!dto.branchId) throw new BadRequestException('Select a laundry shop first');
      const branch = await this.branchesService.getActivePartnerShop(dto.branchId);
      const [branchLng, branchLat] = branch.location.coordinates;
      const customerCoords = resolveCoordinates(address.city, address.latitude, address.longitude);
      const dist = distanceKm(customerCoords, [branchLng, branchLat]);
      if (dist > branch.serviceRadiusKm) {
        throw new BadRequestException('Selected shop does not deliver to this address');
      }
      const basePricePerKg = await this.branchesService.resolveBranchServicePrice(
        branch,
        dto.bookingType,
      );
      priceableService = { ...service, pricePerKg: applyShopMarkup(basePricePerKg) };
    }

    const activeAddons = await this.catalogService.listActiveAddons();
    const addonIds = dto.addonIds ?? [];
    const invalidAddon = addonIds.find((id) => !activeAddons.some((a) => a.id === id));
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
        weightKg: dto.weightKg,
        addonIds,
      },
      priceableService,
      activeAddons,
      deliveryFee,
    );

    if (!quote.meetsMinimum) {
      throw new BadRequestException(
        `Minimum order is ₱${BOOKING_MIN_ORDER_AMOUNT}. Add weight or add-ons to continue.`,
      );
    }

    return this.promotionsService.applyCouponToQuote(quote, dto.couponCode, userId);
  }

  async quote(userId: string, addressId: string, dto: BookingQuoteDto) {
    const { address, area } = await this.validateAddressForUser(userId, addressId);
    const breakdown = await this.buildQuote(dto, area.availableServices, userId, address);
    return { success: true, data: breakdown };
  }

  async prepareOrderPayload(
    userId: string,
    dto: CreateBookingOrderDto,
    partnerContextId?: string,
  ) {
    const { address, area } = await this.validateAddressForUser(userId, dto.pickupAddressId);
    const quote = await this.buildQuote(
      dto,
      area.availableServices,
      userId,
      address,
      Boolean(partnerContextId),
    );
    const slot = generatePickupSlots().find((s) => s.startAt === dto.scheduledPickupAt);
    if (!slot || !isPickupSlotBookable(slot)) {
      throw new BadRequestException('Selected pickup slot is no longer available');
    }

    const items = [
      {
        serviceType: dto.bookingType,
        quantity: quote.weightKg,
        unitPrice: quote.pricePerKg,
        notes: `Estimated ${quote.weightKg} kg`,
      },
      ...quote.addons.map((a) => ({
        serviceType: dto.bookingType,
        quantity: 1,
        unitPrice: a.price,
        notes: `Add-on: ${a.label}`,
      })),
    ];

    let branchId: string | undefined;
    let branchCode: string | undefined;
    let branchName: string | undefined;
    let resolvedPartnerId: string | undefined;
    let baseSubtotal: number | undefined;
    let pricingModel: 'shop_markup' | undefined;

    if (partnerContextId) {
      // White-labeled bookings stay within that partner's own branch pool — no customer choice.
      const partnerBranch = await this.resolvePartnerBranch(
        partnerContextId,
        address,
        dto.bookingType,
        quote.weightKg,
      );
      branchId = partnerBranch.branchId;
      branchCode = partnerBranch.code;
      branchName = partnerBranch.name;
      resolvedPartnerId = partnerContextId;
    } else {
      // General customer flow: the shop they picked at booking time is the order's branch.
      // buildQuote() above already required and validated dto.branchId when not white-label.
      const branch = await this.branchesService.getActivePartnerShop(dto.branchId!);
      const basePricePerKg = await this.branchesService.resolveBranchServicePrice(
        branch,
        dto.bookingType,
      );
      branchId = branch._id.toString();
      branchCode = branch.code;
      branchName = branch.name;
      resolvedPartnerId = branch.partnerUserId.toString();
      baseSubtotal = Math.round(basePricePerKg * quote.weightKg);
      pricingModel = 'shop_markup';
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
        addons: quote.addons,
        subtotal: quote.subtotal,
        deliveryFee: quote.deliveryFee,
        discount: quote.discount,
        total: quote.total,
        branchId,
        branchCode,
        branchName,
        partnerId: resolvedPartnerId,
        baseSubtotal,
        pricingModel,
    };
  }

  /**
   * Picks the best of this partner's own branches for a white-labeled booking. Per product
   * decision, a partner-branded booking always stays with that partner — if none of their
   * branches can accept it, checkout is blocked rather than falling back to admin dispatch.
   */
  private async resolvePartnerBranch(
    partnerContextId: string,
    address: { line1: string; city: string; province: string; latitude?: number; longitude?: number },
    bookingType: BookingType,
    estimatedWeightKg: number,
  ) {
    const evaluation = await this.branchesService.buildDispatchEvaluationsForPartner(
      address,
      bookingType,
      estimatedWeightKg,
      new Types.ObjectId(partnerContextId),
    );

    const eligible = evaluation.branchEvaluations.find((b) => b.availability.acceptingOrders);
    if (!eligible) {
      throw new BadRequestException(
        'This laundry partner is fully booked right now. Please try again later.',
      );
    }

    return { branchId: eligible.branchId, code: eligible.code, name: eligible.name };
  }
}
