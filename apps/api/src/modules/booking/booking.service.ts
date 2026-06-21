import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingType } from '@lunara/types';
import {
  BOOKING_MAX_WEIGHT_KG,
  BOOKING_MIN_ORDER_AMOUNT,
  BOOKING_MIN_WEIGHT_KG,
  calculateQuote,
  EXPRESS_RETURN_ADDON_ID,
  generatePickupSlots,
  isExpressReturnAllowed,
  isPickupSlotBookable,
  PICKUP_SCHEDULE_DAY_COUNT,
  isServiceAvailableInArea,
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
        cityDeliveryFee: deliveryFees.data.cityDeliveryFee,
        provinceDeliveryFee: deliveryFees.data.provinceDeliveryFee,
      },
    };
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
        dispatchNote:
          'After payment, Lunara operations will assign the best partner branch for your area.',
      },
    };
  }

  async buildQuote(
    dto: BookingQuoteDto,
    areaServices: BookingType[],
    userId: string,
    address: { city: string; province: string },
  ) {
    const service = await this.catalogService.findActiveByType(dto.bookingType);
    if (!service) throw new BadRequestException('Invalid or inactive service type');
    if (!isServiceAvailableInArea(dto.bookingType, areaServices)) {
      throw new BadRequestException('This service is not available in your area');
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
      service,
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
    const quote = await this.buildQuote(dto, area.availableServices, userId, address);
    const service = await this.catalogService.findActiveByType(dto.bookingType);
    if (!service) throw new BadRequestException('Invalid or inactive service type');
    const slot = generatePickupSlots().find((s) => s.startAt === dto.scheduledPickupAt);
    if (!slot || !isPickupSlotBookable(slot)) {
      throw new BadRequestException('Selected pickup slot is no longer available');
    }

    const partnerBranch = partnerContextId
      ? await this.resolvePartnerBranch(partnerContextId, address, dto.bookingType, quote.weightKg)
      : undefined;

    const items = [
      {
        serviceType: dto.bookingType,
        quantity: quote.weightKg,
        unitPrice: service.pricePerKg,
        notes: `Estimated ${quote.weightKg} kg`,
      },
      ...quote.addons.map((a) => ({
        serviceType: dto.bookingType,
        quantity: 1,
        unitPrice: a.price,
        notes: `Add-on: ${a.label}`,
      })),
    ];

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
        branchId: partnerBranch?.branchId,
        branchCode: partnerBranch?.code,
        branchName: partnerBranch?.name,
        partnerId: partnerContextId,
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
