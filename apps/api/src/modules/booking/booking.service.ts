import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingType } from '@lunara/types';
import {
  BOOKING_DELIVERY_FEE,
  BOOKING_MAX_WEIGHT_KG,
  BOOKING_MIN_ORDER_AMOUNT,
  BOOKING_MIN_WEIGHT_KG,
  calculateQuote,
  generatePickupSlots,
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
import { BookingQuoteDto, CreateBookingOrderDto } from './dto/booking.dto';

@Injectable()
export class BookingService {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly branchesService: BranchesService,
    private readonly catalogService: CatalogService,
    private readonly promotionsService: PromotionsService,
  ) {}

  async getConfig() {
    const [services, addons] = await Promise.all([
      this.catalogService.listActiveServices(),
      this.catalogService.listActiveAddons(),
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
        deliveryFee: BOOKING_DELIVERY_FEE,
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

    const area = validateServiceArea(fields);
    if (!area.valid) throw new BadRequestException(area.message);

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

  async buildQuote(dto: BookingQuoteDto, areaServices: BookingType[], userId: string) {
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

    const quote = calculateQuote(
      {
        bookingType: dto.bookingType,
        weightKg: dto.weightKg,
        addonIds,
      },
      service,
      activeAddons,
    );

    if (!quote.meetsMinimum) {
      throw new BadRequestException(
        `Minimum order is ₱${BOOKING_MIN_ORDER_AMOUNT}. Add weight or add-ons to continue.`,
      );
    }

    return this.promotionsService.applyCouponToQuote(quote, dto.couponCode, userId);
  }

  async quote(userId: string, addressId: string, dto: BookingQuoteDto) {
    const { area } = await this.validateAddressForUser(userId, addressId);
    const breakdown = await this.buildQuote(dto, area.availableServices, userId);
    return { success: true, data: breakdown };
  }

  async prepareOrderPayload(userId: string, dto: CreateBookingOrderDto) {
    const { area } = await this.validateAddressForUser(userId, dto.pickupAddressId);
    const quote = await this.buildQuote(dto, area.availableServices, userId);
    const service = await this.catalogService.findActiveByType(dto.bookingType);
    if (!service) throw new BadRequestException('Invalid or inactive service type');
    const slot = generatePickupSlots().find((s) => s.startAt === dto.scheduledPickupAt);
    if (!slot || !isPickupSlotBookable(slot)) {
      throw new BadRequestException('Selected pickup slot is no longer available');
    }

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
    };
  }
}
