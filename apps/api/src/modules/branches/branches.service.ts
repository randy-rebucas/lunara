import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingType, OrderStatus, UserRole, type DayOperatingHours, type OperatingHours } from '@lunara/types';
import {
  applyShopMarkup,
  BOOKING_MACHINE_LOAD_MIN_KG,
  BranchPricingMode,
  DEFAULT_OPERATING_HOURS,
  distanceKm,
  estimateSlotCapacityPerHour,
  estimateTurnaroundHours,
  formatDistanceKm,
  GARMENT_CATALOG,
  getTodayScheduleSummary,
  buildPartnerCoverageNotice,
  PICKUP_SCHEDULE_DAY_COUNT,
  rankBranchesForDispatch,
  resolveCoordinates,
  scoreBranchPerformance,
  validatePickupTime,
  type BranchHoliday,
  type PartnerCoverageInfo,
} from '@lunara/utils';
import { Address, AddressDocument } from '../addresses/schemas/address.schema';
import { LocalStorageService } from '../../common/storage/local-storage.service';
import { CatalogService } from '../catalog/catalog.service';
import { ServiceAreasService } from '../service-areas/service-areas.service';
import { SettingsService } from '../settings/settings.service';
import { PartnerTerritoriesService } from '../partners/partner-territories.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserProfile, UserProfileDocument } from '../users/schemas/user-profile.schema';
import { Branch, BranchDocument } from './schemas/branch.schema';
import {
  BranchCustomService,
  BranchCustomServiceDocument,
} from './schemas/branch-custom-service.schema';
import {
  BranchCustomAddon,
  BranchCustomAddonDocument,
} from './schemas/branch-custom-addon.schema';
import { CreateBranchCustomServiceDto } from './dto/create-branch-custom-service.dto';
import { UpdateBranchCustomServiceDto } from './dto/update-branch-custom-service.dto';
import { CreateBranchCustomAddonDto } from './dto/create-branch-custom-addon.dto';
import { UpdateBranchCustomAddonDto } from './dto/update-branch-custom-addon.dto';
import { UpdateBranchHiddenCatalogDto } from './dto/update-branch-hidden-catalog.dto';
import { CreateOwnBranchDto } from './dto/create-own-branch.dto';
import { UpdateOwnBranchDto } from './dto/update-own-branch.dto';

export const CUSTOM_ADDON_ID_PREFIX = 'custom:';

type RateKey =
  | 'basePricePerKg'
  | 'basePricePerLoad'
  | 'basePricePerPiece'
  | 'basePricePerPair'
  | 'basePricePerItem'
  | 'fixedPrice';

const RATE_KEY_LABEL: Record<RateKey, string> = {
  basePricePerKg: 'per-kg',
  basePricePerLoad: 'per-load',
  basePricePerPiece: 'per-piece',
  basePricePerPair: 'per-pair',
  basePricePerItem: 'per-item',
  fixedPrice: 'fixed',
};

const CAPACITY_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.PENDING_DISPATCH,
  OrderStatus.SHOP_ASSIGNED,
  OrderStatus.CONFIRMED,
  OrderStatus.RIDER_ASSIGNED_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT_TO_SHOP,
  OrderStatus.RECEIVED_AT_SHOP,
  OrderStatus.RECEIVED,
  OrderStatus.SORTING,
  OrderStatus.WASHING,
  OrderStatus.DRYING,
  OrderStatus.FOLDING,
  OrderStatus.IRONING,
  OrderStatus.QUALITY_CHECK,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.OUT_FOR_DELIVERY,
];

const DEFAULT_BRANCHES = [
  {
    code: 'MKT-01',
    name: 'Lunara Makati',
    line1: '123 Ayala Ave',
    city: 'Makati',
    province: 'Metro Manila',
    coordinates: [121.0244, 14.5547] as [number, number],
    maxActiveOrders: 25,
    maxWeightCapacityKg: 200,
    serviceRadiusKm: 12,
  },
  {
    code: 'QC-01',
    name: 'Lunara Quezon City',
    line1: '45 Timog Ave',
    city: 'Quezon City',
    province: 'Metro Manila',
    coordinates: [121.0437, 14.676] as [number, number],
    maxActiveOrders: 20,
    maxWeightCapacityKg: 200,
    serviceRadiusKm: 14,
  },
  {
    code: 'BGC-01',
    name: 'Lunara BGC',
    line1: '8th Ave cor 28th St',
    city: 'Taguig',
    province: 'Metro Manila',
    coordinates: [121.0509, 14.5176] as [number, number],
    maxActiveOrders: 18,
    maxWeightCapacityKg: 300,
    serviceRadiusKm: 10,
  },
];

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
    @InjectModel(BranchCustomService.name)
    private customServiceModel: Model<BranchCustomServiceDocument>,
    @InjectModel(BranchCustomAddon.name)
    private customAddonModel: Model<BranchCustomAddonDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfileDocument>,
    private trackingGateway: TrackingGateway,
    private catalogService: CatalogService,
    private storageService: LocalStorageService,
    private serviceAreasService: ServiceAreasService,
    private settingsService: SettingsService,
    private partnerTerritoriesService: PartnerTerritoriesService,
    @Inject(forwardRef(() => RiderAssignmentService))
    private riderAssignmentService: RiderAssignmentService,
  ) {}

  /** What unit this specific service bills the customer in — per-service `pricingUnit` override,
   * falling back to the branch-level `pricingMode` for services configured before per-service
   * units existed. */
  resolveServicePricingUnit(branch: BranchDocument, bookingType: BookingType): BranchPricingMode {
    const override = branch.servicePricing?.find((p) => p.serviceType === bookingType);
    return override?.pricingUnit ?? branch.pricingMode ?? BranchPricingMode.FLAT_BAG;
  }

  /** Shop's own price/kg for a service; falls back to the global catalog price when not customized. */
  async resolveBranchServicePrice(branch: BranchDocument, bookingType: BookingType) {
    const override = branch.servicePricing?.find((p) => p.serviceType === bookingType);
    if (override?.basePricePerKg != null) return override.basePricePerKg;
    const service = await this.catalogService.findActiveByType(bookingType);
    return service?.pricePerKg ?? 0;
  }

  /** Holidays set directly on this branch, or inherited from the partner's main shop when this
   * branch hasn't defined its own (per-partner holiday model — set once on the main shop, applies
   * network-wide for that partner unless a specific branch opts to override it). */
  async resolveBranchHolidays(branch: BranchDocument) {
    if (branch.holidays?.length) return branch.holidays;
    if (branch.isMainShop) return [];
    const mainShop = await this.branchModel
      .findOne({ partnerUserId: branch.partnerUserId, isMainShop: true, isActive: true })
      .lean();
    return mainShop?.holidays ?? [];
  }

  /** Shop's own price for an add-on; falls back to the global catalog price when not customized.
   * Also resolves branch-owned custom add-ons (id prefixed with CUSTOM_ADDON_ID_PREFIX). */
  async resolveBranchAddonPrice(branch: BranchDocument, addonSlug: string) {
    if (addonSlug.startsWith(CUSTOM_ADDON_ID_PREFIX)) {
      const slug = addonSlug.slice(CUSTOM_ADDON_ID_PREFIX.length);
      const custom = await this.customAddonModel.findOne({
        branchId: branch._id,
        slug,
        isActive: true,
      });
      return custom?.price ?? 0;
    }
    const override = branch.addonPricing?.find((p) => p.addonSlug === addonSlug);
    if (override) return override.basePrice;
    const addon = await this.catalogService.findActiveAddonBySlug(addonSlug);
    return addon?.price ?? 0;
  }

  /** What unit this add-on bills the customer in — custom add-ons (branch-owned) are always flat. */
  resolveAddonPricingUnit(branch: BranchDocument, addonSlug: string): BranchPricingMode {
    if (addonSlug.startsWith(CUSTOM_ADDON_ID_PREFIX)) return BranchPricingMode.FLAT_BAG;
    const override = branch.addonPricing?.find((p) => p.addonSlug === addonSlug);
    return override?.pricingUnit ?? BranchPricingMode.FLAT_BAG;
  }

  /** The rate to bill at for this add-on's own pricing unit — the per-kg/load/piece override when
   * set, or the flat/global price as fallback (mirrors resolveBranchAddonPrice for the flat case). */
  async resolveAddonRateForUnit(
    branch: BranchDocument,
    addonSlug: string,
    unit: BranchPricingMode,
  ): Promise<number> {
    if (addonSlug.startsWith(CUSTOM_ADDON_ID_PREFIX)) {
      return this.resolveBranchAddonPrice(branch, addonSlug);
    }
    const override = branch.addonPricing?.find((p) => p.addonSlug === addonSlug);
    switch (unit) {
      case BranchPricingMode.PER_KG:
        return override?.basePricePerKg ?? 0;
      case BranchPricingMode.PER_LOAD:
        return override?.basePricePerLoad ?? 0;
      case BranchPricingMode.PER_PIECE:
        return override?.basePricePerPiece ?? 0;
      case BranchPricingMode.PER_PAIR:
        return override?.basePricePerPair ?? 0;
      case BranchPricingMode.PER_ITEM:
        return override?.basePricePerItem ?? 0;
      case BranchPricingMode.FIXED:
        return override?.fixedPrice ?? 0;
      case BranchPricingMode.FLAT_BAG:
      default:
        return this.resolveBranchAddonPrice(branch, addonSlug);
    }
  }

  /** How many units of this add-on the shop bundles free into the service — customer-chosen
   * quantity beyond this is what actually gets billed. Custom (branch-owned) add-ons don't
   * support bundling since they have no separate package/service relationship to bundle into. */
  resolveAddonIncludedQuantity(branch: BranchDocument, addonSlug: string): number {
    if (addonSlug.startsWith(CUSTOM_ADDON_ID_PREFIX)) return 0;
    const override = branch.addonPricing?.find((p) => p.addonSlug === addonSlug);
    return override?.includedQuantity ?? 0;
  }

  /** Branch's own active custom add-ons, shaped like BookingAddonOption for use alongside the
   * global catalog list in the booking quote/order path. */
  async listCustomAddonOptions(branch: BranchDocument) {
    const customAddons = await this.customAddonModel.find({
      branchId: branch._id,
      isActive: true,
    });
    return customAddons.map((custom) => ({
      id: `${CUSTOM_ADDON_ID_PREFIX}${custom.slug}`,
      label: custom.label,
      description: custom.description,
      price: custom.price,
      applicableServiceTypes: custom.applicableServiceTypes as BookingType[] | undefined,
      allowsQuantity: custom.allowsQuantity,
      maxQuantity: custom.maxQuantity,
    }));
  }

  /** GARMENT_CATALOG with each item's price swapped for this shop's own override, when set —
   * mirrors resolveBranchServicePrice/resolveAddonRateForUnit for garment pricing. */
  resolveBranchGarmentCatalog(branch: BranchDocument): typeof GARMENT_CATALOG {
    const overrides = new Map((branch.garmentPricing ?? []).map((p) => [p.garmentId, p.price]));
    if (overrides.size === 0) return GARMENT_CATALOG;
    return GARMENT_CATALOG.map((garment) =>
      overrides.has(garment.id) ? { ...garment, price: overrides.get(garment.id)! } : garment,
    );
  }

  /** GARMENT_CATALOG (with this shop's price overrides applied) filtered to what this shop
   * actually does dry cleaning for — mirrors how serializeShopPricing/serializeShopAddonPricing
   * filter by hiddenServiceTypes/hiddenAddonSlugs. */
  private serializeShopGarmentCatalog(branch: BranchDocument, includeHidden = false) {
    const catalog = this.resolveBranchGarmentCatalog(branch);
    if (includeHidden) return catalog;
    const hidden = new Set(branch.hiddenGarmentItemIds ?? []);
    return catalog.filter((garment) => !hidden.has(garment.id));
  }

  private async serializeShopPricing(branch: BranchDocument, includeHidden = false) {
    const services = await this.catalogService.listActiveServices();
    const hidden = new Set(branch.hiddenServiceTypes ?? []);
    const globalItems = await Promise.all(
      services
        .filter((service) => includeHidden || !hidden.has(service.type))
        .map(async (service) => {
          // Inline resolveBranchServicePrice's fallback instead of calling it: `service` here
          // already carries the same pricePerKg that a re-query by type would return, so calling
          // it would re-fetch this exact document from Mongo once per service for no new data.
          const override = branch.servicePricing?.find((p) => p.serviceType === service.type);
          const basePricePerKg = override?.basePricePerKg ?? service.pricePerKg ?? 0;
          return {
            type: service.type,
            label: service.label,
            category: service.category,
            basePricePerKg,
            basePricePerLoad: override?.basePricePerLoad,
            basePricePerPiece: override?.basePricePerPiece,
            basePricePerPair: override?.basePricePerPair,
            basePricePerItem: override?.basePricePerItem,
            fixedPrice: override?.fixedPrice,
            pricingUnit: override?.pricingUnit ?? branch.pricingMode ?? BranchPricingMode.FLAT_BAG,
            // What the customer actually pays (base rate + Lunara's markup) — clients must price
            // and display off these, never the raw baseXxx fields above, which are the partner's
            // own rate before markup (see priceOneService, the only place base rates are marked up
            // for real orders).
            customerPricePerKg: applyShopMarkup(basePricePerKg),
            customerPricePerLoad: override?.basePricePerLoad != null ? applyShopMarkup(override.basePricePerLoad) : undefined,
            customerPricePerPiece: override?.basePricePerPiece != null ? applyShopMarkup(override.basePricePerPiece) : undefined,
            customerPricePerPair: override?.basePricePerPair != null ? applyShopMarkup(override.basePricePerPair) : undefined,
            customerPricePerItem: override?.basePricePerItem != null ? applyShopMarkup(override.basePricePerItem) : undefined,
            customerFixedPrice: override?.fixedPrice != null ? applyShopMarkup(override.fixedPrice) : undefined,
            isCustom: false,
          };
        }),
    );

    const customServices = await this.customServiceModel.find({
      branchId: branch._id,
      isActive: true,
    });
    const customItems = customServices.map((custom) => {
      const unit = custom.pricingUnit ?? BranchPricingMode.PER_KG;
      return {
        type: custom.baseBookingType,
        label: custom.label,
        description: custom.description,
        basePricePerKg: custom.pricePerKg,
        basePricePerLoad: custom.basePricePerLoad,
        basePricePerPiece: custom.basePricePerPiece,
        basePricePerPair: custom.basePricePerPair,
        basePricePerItem: custom.basePricePerItem,
        fixedPrice: custom.fixedPrice,
        pricingUnit: unit,
        customerPricePerKg: applyShopMarkup(this.resolveCustomServiceRate(custom, unit)),
        customerPricePerLoad: custom.basePricePerLoad != null ? applyShopMarkup(custom.basePricePerLoad) : undefined,
        customerPricePerPiece: custom.basePricePerPiece != null ? applyShopMarkup(custom.basePricePerPiece) : undefined,
        customerPricePerPair: custom.basePricePerPair != null ? applyShopMarkup(custom.basePricePerPair) : undefined,
        customerPricePerItem: custom.basePricePerItem != null ? applyShopMarkup(custom.basePricePerItem) : undefined,
        customerFixedPrice: custom.fixedPrice != null ? applyShopMarkup(custom.fixedPrice) : undefined,
        isCustom: true,
        customServiceId: custom._id.toString(),
      };
    });

    return [...globalItems, ...customItems];
  }

  /** The active rate for a custom service's own pricing unit — mirrors resolveAddonRateForUnit
   * for branch-owned custom services (which have no global-catalog fallback). */
  private resolveCustomServiceRate(custom: BranchCustomServiceDocument, unit: BranchPricingMode): number {
    switch (unit) {
      case BranchPricingMode.PER_LOAD:
        return custom.basePricePerLoad ?? 0;
      case BranchPricingMode.PER_PIECE:
        return custom.basePricePerPiece ?? 0;
      case BranchPricingMode.PER_PAIR:
        return custom.basePricePerPair ?? 0;
      case BranchPricingMode.PER_ITEM:
        return custom.basePricePerItem ?? 0;
      case BranchPricingMode.FIXED:
        return custom.fixedPrice ?? 0;
      case BranchPricingMode.PER_KG:
      default:
        return custom.pricePerKg ?? 0;
    }
  }

  private async serializeShopAddonPricing(branch: BranchDocument, includeHidden = false) {
    const addons = await this.catalogService.listActiveAddons();
    const hidden = new Set(branch.hiddenAddonSlugs ?? []);
    const globalItems = await Promise.all(
      addons
        .filter((addon) => includeHidden || !hidden.has(addon.id))
        .map(async (addon) => {
          // Percent-of-service add-ons (Express/Same-Day) bill off the order's service subtotal,
          // not a shop-set rate — global-catalog-only, not partner-configurable, and never marked up.
          if (addon.isPercentOfService) {
            return {
              slug: addon.id,
              label: addon.label,
              category: addon.category,
              basePrice: addon.price,
              customerPrice: addon.price,
              isPercentOfService: true,
              isCustom: false,
            };
          }
          // Inline resolveBranchAddonPrice/resolveAddonRateForUnit's fallbacks instead of calling
          // them: `addon` here already carries the same catalog price those would otherwise
          // re-query Mongo for, once per addon, for no new data.
          const override = branch.addonPricing?.find((p) => p.addonSlug === addon.id);
          const pricingUnit = override?.pricingUnit ?? BranchPricingMode.FLAT_BAG;
          const basePrice = override?.basePrice ?? addon.price;
          const rateByUnit: Partial<Record<BranchPricingMode, number | undefined>> = {
            [BranchPricingMode.PER_KG]: override?.basePricePerKg,
            [BranchPricingMode.PER_LOAD]: override?.basePricePerLoad,
            [BranchPricingMode.PER_PIECE]: override?.basePricePerPiece,
            [BranchPricingMode.PER_PAIR]: override?.basePricePerPair,
            [BranchPricingMode.PER_ITEM]: override?.basePricePerItem,
            [BranchPricingMode.FIXED]: override?.fixedPrice,
          };
          const activeRate = rateByUnit[pricingUnit] ?? (pricingUnit in rateByUnit ? 0 : basePrice);
          return {
            slug: addon.id,
            label: addon.label,
            category: addon.category,
            basePrice,
            basePricePerKg: override?.basePricePerKg,
            basePricePerLoad: override?.basePricePerLoad,
            basePricePerPiece: override?.basePricePerPiece,
            basePricePerPair: override?.basePricePerPair,
            basePricePerItem: override?.basePricePerItem,
            fixedPrice: override?.fixedPrice,
            pricingUnit,
            customerPrice: applyShopMarkup(activeRate),
            isCustom: false,
            applicableServiceTypes: override?.applicableServiceTypes,
            // Global-catalog quantity settings (e.g. fabric softener: allowsQuantity + maxQuantity
            // 5) — dropping these here (unlike customItems below) left the customer-facing add-on
            // list unable to show or drive the quantity stepper for any global add-on, even though
            // the actual quote/order pricing path (listPriceableAddonOptions) always preserved them.
            allowsQuantity: addon.allowsQuantity,
            maxQuantity: addon.maxQuantity,
            includedQuantity: override?.includedQuantity ?? 0,
          };
        }),
    );

    const customAddons = await this.customAddonModel.find({
      branchId: branch._id,
      isActive: true,
    });
    const customItems = customAddons.map((custom) => ({
      slug: `${CUSTOM_ADDON_ID_PREFIX}${custom.slug}`,
      label: custom.label,
      description: custom.description,
      basePrice: custom.price,
      customerPrice: applyShopMarkup(custom.price),
      isCustom: true,
      customAddonId: custom._id.toString(),
      applicableServiceTypes: custom.applicableServiceTypes,
      allowsQuantity: custom.allowsQuantity,
      maxQuantity: custom.maxQuantity,
    }));

    return [...globalItems, ...customItems];
  }

  /** Global catalog addon options (BookingAddonOption shape) minus this branch's hidden slugs,
   * plus this branch's own active custom add-ons — used by booking.service.ts's quote/order path. */
  async listPriceableAddonOptions(branch: BranchDocument) {
    const globalAddons = await this.catalogService.listActiveAddons();
    const hidden = new Set(branch.hiddenAddonSlugs ?? []);
    const visibleGlobal = globalAddons
      .filter((addon) => !hidden.has(addon.id))
      .map((addon) => {
        const override = branch.addonPricing?.find((p) => p.addonSlug === addon.id);
        return override?.applicableServiceTypes?.length
          ? { ...addon, applicableServiceTypes: override.applicableServiceTypes as BookingType[] }
          : addon;
      });
    const customAddons = await this.listCustomAddonOptions(branch);
    return [...visibleGlobal, ...customAddons];
  }

  /** Resolves a service (global type or custom service id) for order pricing. */
  async resolvePriceableService(
    branch: BranchDocument,
    bookingType: BookingType,
    customServiceId?: string,
  ) {
    if (customServiceId) {
      const custom = await this.customServiceModel.findOne({
        _id: customServiceId,
        branchId: branch._id,
        isActive: true,
      });
      if (!custom) throw new NotFoundException('Custom service not found');
      return {
        bookingType: custom.baseBookingType,
        label: custom.label,
        description: custom.description,
        pricePerKg: custom.pricePerKg,
      };
    }
    const basePricePerKg = await this.resolveBranchServicePrice(branch, bookingType);
    return { bookingType, pricePerKg: basePricePerKg };
  }

  /** Custom services carry their own pricingUnit/rates independent of the branch's base
   * BookingType pricing — used by booking.service.ts's quote path instead of
   * resolveServicePricingUnit/branch.servicePricing whenever a customServiceId is selected. */
  async resolveCustomServicePricing(branch: BranchDocument, customServiceId: string) {
    const custom = await this.customServiceModel.findOne({
      _id: customServiceId,
      branchId: branch._id,
      isActive: true,
    });
    if (!custom) throw new NotFoundException('Custom service not found');
    const pricingMode = custom.pricingUnit ?? BranchPricingMode.PER_KG;
    return {
      pricingMode,
      rates: {
        basePricePerKg: custom.pricePerKg,
        basePricePerLoad: custom.basePricePerLoad,
        basePricePerPiece: custom.basePricePerPiece,
        basePricePerPair: custom.basePricePerPair,
        basePricePerItem: custom.basePricePerItem,
        fixedPrice: custom.fixedPrice,
      },
    };
  }

  /** Whether the branch offers this BookingType — false if hidden, unless a custom service overrides it. */
  async isServiceTypeOfferedByBranch(branch: BranchDocument, bookingType: BookingType) {
    if (!branch.hiddenServiceTypes?.includes(bookingType)) return true;
    const customOverride = await this.customServiceModel.exists({
      branchId: branch._id,
      baseBookingType: bookingType,
      isActive: true,
    });
    return !!customOverride;
  }

  async createCustomService(
    branchId: string,
    partnerUserId: string,
    dto: CreateBranchCustomServiceDto,
  ) {
    const branch = await this.branchModel.findById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');
    this.assertCustomServiceRateConfigured(dto);
    const created = await this.customServiceModel.create({
      branchId: branch._id,
      partnerUserId: new Types.ObjectId(partnerUserId),
      baseBookingType: dto.baseBookingType,
      label: dto.label,
      description: dto.description,
      pricePerKg: dto.pricePerKg,
      basePricePerLoad: dto.basePricePerLoad,
      basePricePerPiece: dto.basePricePerPiece,
      basePricePerPair: dto.basePricePerPair,
      basePricePerItem: dto.basePricePerItem,
      fixedPrice: dto.fixedPrice,
      pricingUnit: dto.pricingUnit,
      minWeightKg: dto.minWeightKg ?? 5,
      sortOrder: dto.sortOrder ?? 0,
    });
    return { success: true, data: { _id: created._id.toString() } };
  }

  async updateCustomService(
    branchId: string,
    serviceId: string,
    dto: UpdateBranchCustomServiceDto,
  ) {
    const custom = await this.customServiceModel.findOne({
      _id: serviceId,
      branchId: new Types.ObjectId(branchId),
    });
    if (!custom) throw new NotFoundException('Custom service not found');
    this.assertCustomServiceRateConfigured({ ...custom.toObject(), ...dto });
    Object.assign(custom, dto);
    await custom.save();
    return { success: true, data: { _id: custom._id.toString() } };
  }

  /** Mirrors updateServicePricing's guard — the rate for a custom service's chosen pricingUnit
   * must be set before it can bill in that unit. */
  private assertCustomServiceRateConfigured(
    service: Partial<
      Pick<
        BranchCustomService,
        | 'pricingUnit'
        | 'pricePerKg'
        | 'basePricePerLoad'
        | 'basePricePerPiece'
        | 'basePricePerPair'
        | 'basePricePerItem'
        | 'fixedPrice'
      >
    >,
  ) {
    const rateKeyByUnit: Partial<Record<BranchPricingMode, RateKey>> = {
      [BranchPricingMode.PER_KG]: 'basePricePerKg',
      [BranchPricingMode.PER_LOAD]: 'basePricePerLoad',
      [BranchPricingMode.PER_PIECE]: 'basePricePerPiece',
      [BranchPricingMode.PER_PAIR]: 'basePricePerPair',
      [BranchPricingMode.PER_ITEM]: 'basePricePerItem',
      [BranchPricingMode.FIXED]: 'fixedPrice',
    };
    const unit = service.pricingUnit ?? BranchPricingMode.PER_KG;
    const rateKey = rateKeyByUnit[unit];
    if (!rateKey) return;
    const value = rateKey === 'basePricePerKg' ? service.pricePerKg : service[rateKey];
    if (value == null) {
      throw new BadRequestException(`Set a ${RATE_KEY_LABEL[rateKey]} rate for this custom service`);
    }
  }

  async deleteCustomService(branchId: string, serviceId: string) {
    const result = await this.customServiceModel.deleteOne({
      _id: serviceId,
      branchId: new Types.ObjectId(branchId),
    });
    if (result.deletedCount === 0) throw new NotFoundException('Custom service not found');
    return { success: true };
  }

  async createCustomAddon(
    branchId: string,
    partnerUserId: string,
    dto: CreateBranchCustomAddonDto,
  ) {
    const branch = await this.branchModel.findById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');
    try {
      const created = await this.customAddonModel.create({
        branchId: branch._id,
        partnerUserId: new Types.ObjectId(partnerUserId),
        slug: dto.slug,
        label: dto.label,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl ?? null,
        applicableServiceTypes: dto.applicableServiceTypes ?? [],
        allowsQuantity: dto.allowsQuantity ?? false,
        maxQuantity: dto.maxQuantity ?? 5,
      });
      return { success: true, data: { _id: created._id.toString() } };
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new BadRequestException('Slug already exists for this shop');
      }
      throw err;
    }
  }

  async updateCustomAddon(branchId: string, addonId: string, dto: UpdateBranchCustomAddonDto) {
    const custom = await this.customAddonModel.findOne({
      _id: addonId,
      branchId: new Types.ObjectId(branchId),
    });
    if (!custom) throw new NotFoundException('Custom add-on not found');
    Object.assign(custom, dto);
    try {
      await custom.save();
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new BadRequestException('Slug already exists for this shop');
      }
      throw err;
    }
    return { success: true, data: { _id: custom._id.toString() } };
  }

  async deleteCustomAddon(branchId: string, addonId: string) {
    const result = await this.customAddonModel.deleteOne({
      _id: addonId,
      branchId: new Types.ObjectId(branchId),
    });
    if (result.deletedCount === 0) throw new NotFoundException('Custom add-on not found');
    return { success: true };
  }

  async updateHiddenCatalog(branchId: string, dto: UpdateBranchHiddenCatalogDto) {
    if (dto.garmentPricing !== undefined) {
      const catalogIds = new Set(GARMENT_CATALOG.map((g) => g.id));
      const unknown = dto.garmentPricing.find((p) => !catalogIds.has(p.garmentId));
      if (unknown) {
        throw new BadRequestException(`Unknown garment id: ${unknown.garmentId}`);
      }
    }
    const update: Record<string, unknown> = {};
    if (dto.hiddenServiceTypes !== undefined) update.hiddenServiceTypes = dto.hiddenServiceTypes;
    if (dto.hiddenAddonSlugs !== undefined) update.hiddenAddonSlugs = dto.hiddenAddonSlugs;
    if (dto.hiddenGarmentItemIds !== undefined) update.hiddenGarmentItemIds = dto.hiddenGarmentItemIds;
    if (dto.garmentPricing !== undefined) update.garmentPricing = dto.garmentPricing;
    const branch = await this.branchModel.findByIdAndUpdate(branchId, { $set: update }, { new: true });
    if (!branch) throw new NotFoundException('Branch not found');
    return {
      success: true,
      data: {
        hiddenServiceTypes: branch.hiddenServiceTypes,
        hiddenAddonSlugs: branch.hiddenAddonSlugs,
        hiddenGarmentItemIds: branch.hiddenGarmentItemIds,
        garmentPricing: branch.garmentPricing,
      },
    };
  }

  async setAssignedRider(branchId: string, riderId?: string | null) {
    const branch = await this.branchModel.findById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');

    if (!riderId) {
      branch.assignedRiderId = undefined;
    } else {
      const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(riderId) });
      if (!rider) throw new NotFoundException('Rider not found');
      branch.assignedRiderId = new Types.ObjectId(riderId);
    }

    await branch.save();
    return { success: true, data: { assignedRiderId: branch.assignedRiderId?.toString() ?? null } };
  }

  async setBranchLogo(branchId: string, file: Express.Multer.File) {
    const branch = await this.branchModel.findById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');

    const previousLogoUrl = branch.logoUrl;
    const result = await this.storageService.uploadBuffer(
      file.buffer,
      'lunara/branch-logos',
      `${branch._id.toString()}-${Date.now()}`,
      'image',
      file.mimetype,
    );
    branch.logoUrl = result.secure_url;
    await branch.save();
    await this.storageService.deleteFile('lunara/branch-logos', previousLogoUrl);
    return { success: true, data: { logoUrl: branch.logoUrl } };
  }

  async clearBranchLogo(branchId: string) {
    const branch = await this.branchModel.findById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');

    const previousLogoUrl = branch.logoUrl;
    branch.logoUrl = undefined;
    await branch.save();
    await this.storageService.deleteFile('lunara/branch-logos', previousLogoUrl);
    return { success: true, data: { logoUrl: null } };
  }

  async listCustomServicesForBranch(branchId: string) {
    return this.customServiceModel
      .find({ branchId: new Types.ObjectId(branchId) })
      .sort({ sortOrder: 1 });
  }

  async listCustomAddonsForBranch(branchId: string) {
    return this.customAddonModel
      .find({ branchId: new Types.ObjectId(branchId) })
      .sort({ sortOrder: 1 });
  }

  // ── Machines (embedded on the branch; managed by the owning partner) ─────

  /** Throws if the branch isn't owned by this partner user — guards partner-facing pricing writes/reads. */
  assertBranchOwnedByPartner(branch: BranchDocument, partnerUserId: string) {
    if (branch.partnerUserId.toString() !== partnerUserId) {
      throw new NotFoundException('Branch not found');
    }
  }

  /** All shops a partner owns — for the partner-web branch selector when editing pricing, and for
   * the Branches management page. */
  async listBranchesForPartner(partnerUserId: string) {
    const branches = await this.branchModel
      .find({ partnerUserId: new Types.ObjectId(partnerUserId) })
      .select('code name branchType city line1 province isActive isMainShop maxActiveOrders serviceRadiusKm logoUrl location')
      .sort({ name: 1 });
    return {
      success: true,
      data: branches.map((b) => ({
        _id: b._id.toString(),
        code: b.code,
        name: b.name,
        branchType: b.branchType,
        city: b.city,
        line1: b.line1,
        province: b.province,
        isActive: b.isActive,
        isMainShop: b.isMainShop,
        maxActiveOrders: b.maxActiveOrders,
        serviceRadiusKm: b.serviceRadiusKm,
        logoUrl: b.logoUrl,
        latitude: b.location?.coordinates?.[1],
        longitude: b.location?.coordinates?.[0],
      })),
    };
  }

  /** Ownership-checked variant of getShopPricing/updateServicePricing/updateAddonPricing for the partner portal. */
  async getOwnBranchOrThrow(branchId: string, partnerUserId: string) {
    const branch = await this.branchModel.findById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');
    this.assertBranchOwnedByPartner(branch, partnerUserId);
    return branch;
  }

  /** Generates a unique branch code from the shop name (partner self-service flow doesn't ask the
   * partner to pick one, unlike the admin-created-branch flow). Retries on the unique-index
   * collision, mirroring createCustomAddon's slug-collision handling below. */
  private async generateUniqueBranchCode(name: string): Promise<string> {
    const base = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 20) || 'BRANCH';
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      const candidate = `${base}-${suffix}`;
      const exists = await this.branchModel.exists({ code: candidate });
      if (!exists) return candidate;
    }
    throw new BadRequestException('Could not generate a unique branch code, please try again');
  }

  /** Partner self-service branch creation — mirrors BranchManagementService.createBranch's
   * defaults/first-branch-is-main-shop rule, but auto-derives code/branchType/partnerUserId/
   * managerUserId instead of taking them from the (admin-only) request body. */
  async createBranchForPartner(partnerUserId: string, dto: CreateOwnBranchDto) {
    const code = await this.generateUniqueBranchCode(dto.name);
    const coordinates = dto.coordinates ?? resolveCoordinates(dto.city);

    const hasMainShop = await this.branchModel.exists({
      partnerUserId: new Types.ObjectId(partnerUserId),
      isMainShop: true,
      isActive: true,
    });

    const branch = await this.branchModel.create({
      code,
      name: dto.name,
      branchType: 'partner_shop',
      line1: dto.line1,
      city: dto.city,
      province: dto.province,
      partnerUserId: new Types.ObjectId(partnerUserId),
      managerUserId: new Types.ObjectId(partnerUserId),
      isMainShop: !hasMainShop,
      maxActiveOrders: dto.maxActiveOrders ?? 20,
      maxWeightCapacityKg: dto.maxWeightCapacityKg ?? 200,
      dailyQuotaOrders: dto.dailyQuotaOrders ?? 25,
      dailyQuotaWeightKg: dto.dailyQuotaWeightKg ?? 200,
      serviceRadiusKm: dto.serviceRadiusKm ?? 12,
      isActive: true,
      location: { type: 'Point', coordinates },
      // New shops start dry cleaning fully unconfigured — the partner opts garments in one by one.
      hiddenGarmentItemIds: GARMENT_CATALOG.map((g) => g.id),
    });

    return {
      success: true,
      data: { branchId: branch._id.toString(), code: branch.code, name: branch.name },
    };
  }

  /** Partner self-service branch update — restricted to the fields a partner may change
   * themselves (name/address/capacity/active). Reuses BranchManagementService.updateBranch's
   * guard against deactivating a branch with orders still in progress. */
  async updateBranchForPartner(branchId: string, partnerUserId: string, dto: UpdateOwnBranchDto) {
    const branch = await this.getOwnBranchOrThrow(branchId, partnerUserId);

    if (dto.isActive === false && branch.isActive) {
      const activeOrderCount = await this.orderModel.countDocuments({
        branchId: branch._id,
        status: { $in: CAPACITY_STATUSES },
      });
      if (activeOrderCount > 0) {
        throw new BadRequestException(
          `Cannot deactivate: ${activeOrderCount} order(s) still in progress at this branch`,
        );
      }
    }

    if (dto.name !== undefined) branch.name = dto.name;
    if (dto.line1 !== undefined) branch.line1 = dto.line1;
    if (dto.city !== undefined) branch.city = dto.city;
    if (dto.province !== undefined) branch.province = dto.province;
    if (dto.coordinates !== undefined) {
      branch.location = { type: 'Point', coordinates: dto.coordinates };
    }
    if (dto.maxActiveOrders !== undefined) branch.maxActiveOrders = dto.maxActiveOrders;
    if (dto.maxWeightCapacityKg !== undefined) branch.maxWeightCapacityKg = dto.maxWeightCapacityKg;
    if (dto.dailyQuotaOrders !== undefined) branch.dailyQuotaOrders = dto.dailyQuotaOrders;
    if (dto.dailyQuotaWeightKg !== undefined) branch.dailyQuotaWeightKg = dto.dailyQuotaWeightKg;
    if (dto.serviceRadiusKm !== undefined) branch.serviceRadiusKm = dto.serviceRadiusKm;
    if (dto.isActive !== undefined) branch.isActive = dto.isActive;

    await branch.save();
    return {
      success: true,
      data: {
        _id: branch._id.toString(),
        code: branch.code,
        name: branch.name,
        branchType: branch.branchType,
        city: branch.city,
        line1: branch.line1,
        province: branch.province,
        isActive: branch.isActive,
        isMainShop: branch.isMainShop,
        maxActiveOrders: branch.maxActiveOrders,
        serviceRadiusKm: branch.serviceRadiusKm,
        logoUrl: branch.logoUrl,
        latitude: branch.location?.coordinates?.[1],
        longitude: branch.location?.coordinates?.[0],
      },
    };
  }

  /** Active partner shops near an address, each with its own marked-up prices, for the customer shop-selection step.
   * Grouped by partner — a partner's other branches are variants of their one shop, not separate
   * listings, so each group headlines its nearest branch and lists the rest under `branches`. */
  async findNearbyShopsWithPricing(
    address: {
      city: string;
      latitude?: number;
      longitude?: number;
    },
    partnerUserId?: string,
  ) {
    await this.ensureSeeded();
    const customerCoords = resolveCoordinates(address.city, address.latitude, address.longitude);
    const maxDeliveryRadiusKm = await this.settingsService.getMaxDeliveryRadiusKm();
    const branches = await this.branchModel.find({
      isActive: true,
      branchType: 'partner_shop',
      ...(partnerUserId ? { partnerUserId: new Types.ObjectId(partnerUserId) } : {}),
    });

    const ranked = await Promise.all(
      branches.map(async (branch) => {
        const [lng, lat] = branch.location.coordinates;
        const dist = distanceKm(customerCoords, [lng, lat]);
        const activeOrders = await this.countActiveOrders(branch._id);
        const todaysOrders = await this.countTodaysOrders(branch._id);
        const services = await this.serializeShopPricing(branch);
        const addons = await this.serializeShopAddonPricing(branch);
        const garmentCatalog = this.serializeShopGarmentCatalog(branch);
        const holidays = await this.resolveBranchHolidays(branch);
        const operatingHours =
          branch.operatingHours?.length === 7 ? branch.operatingHours : DEFAULT_OPERATING_HOURS;
        return {
          branchId: branch._id.toString(),
          partnerUserId: branch.partnerUserId.toString(),
          isMainShop: branch.isMainShop,
          code: branch.code,
          name: branch.name,
          city: branch.city,
          distanceKm: Math.round(dist * 10) / 10,
          distanceLabel: formatDistanceKm(dist),
          withinRadius: dist <= branch.serviceRadiusKm,
          // Mirrors buildQuote's own tiering (booking.service.ts) — beyond this, checkout always
          // rejects the order regardless of branch, so the client must never treat it as pickable.
          withinMaxDeliveryRadius: dist <= maxDeliveryRadiusKm,
          capacityAvailable:
            activeOrders < branch.maxActiveOrders && todaysOrders < branch.dailyQuotaOrders,
          logoUrl: branch.logoUrl,
          pricingMode: branch.pricingMode ?? BranchPricingMode.FLAT_BAG,
          kgPerLoad: branch.kgPerLoad ?? BOOKING_MACHINE_LOAD_MIN_KG,
          operatingHours,
          holidays,
          todaySchedule: getTodayScheduleSummary(operatingHours, holidays),
          services,
          addons,
          garmentCatalog,
        };
      }),
    );

    ranked.sort((a, b) => a.distanceKm - b.distanceKm);

    const byPartner = new Map<string, typeof ranked>();
    for (const entry of ranked) {
      const list = byPartner.get(entry.partnerUserId) ?? [];
      list.push(entry);
      byPartner.set(entry.partnerUserId, list);
    }

    const shops = [...byPartner.values()].map((group) => {
      // Group is already distance-sorted (built from the sorted `ranked` list), so [0] is nearest.
      const nearest = group[0];
      const mainShop = group.find((b) => b.isMainShop) ?? nearest;
      return {
        ...nearest,
        mainShopId: mainShop.branchId,
        // Each entry already carries everything findNearbyShopsWithPricing computed for it
        // (pricing, schedule, withinRadius, capacity) — reuse it as-is so the unfiltered
        // (non-partner) client can render every branch as its own full option, not just the
        // group headline.
        branches: group.map((b) => ({ ...b })),
      };
    });

    shops.sort((a, b) => a.distanceKm - b.distanceKm);
    return { success: true, data: shops };
  }

  async findNearbyShopsForAddressId(userId: string, addressId: string, partnerUserId?: string) {
    const address = await this.addressModel.findOne({
      _id: addressId,
      userId: new Types.ObjectId(userId),
    });
    if (!address) throw new NotFoundException('Address not found');
    return this.findNearbyShopsWithPricing(
      {
        city: address.city,
        latitude: address.latitude,
        longitude: address.longitude,
      },
      partnerUserId,
    );
  }

  /** Validated partner-shop branch document for the customer booking flow — active, correct type. */
  async getActivePartnerShop(branchId: string) {
    const branch = await this.branchModel.findById(branchId);
    if (!branch || !branch.isActive || branch.branchType !== 'partner_shop') {
      throw new BadRequestException('Selected shop is not available');
    }
    return branch;
  }

  /**
   * `includeHidden` controls whether services/add-ons the shop has hidden are included in the
   * response: false (default) for the customer-facing "what does this shop offer" view, true for
   * the partner's own pricing editor — which needs to see hidden items too so it can toggle them
   * back on (a hidden item that's filtered out can never be un-hidden from that UI again).
   */
  async getShopPricing(branchId: string, includeHidden = false) {
    const branch = await this.branchModel.findById(branchId);
    if (!branch || !branch.isActive || branch.branchType !== 'partner_shop') {
      throw new NotFoundException('Shop not found');
    }
    return {
      success: true,
      data: {
        pricingMode: branch.pricingMode,
        kgPerLoad: branch.kgPerLoad ?? BOOKING_MACHINE_LOAD_MIN_KG,
        services: await this.serializeShopPricing(branch, includeHidden),
        addons: await this.serializeShopAddonPricing(branch, includeHidden),
        garmentCatalog: this.serializeShopGarmentCatalog(branch, includeHidden),
        hiddenServiceTypes: branch.hiddenServiceTypes ?? [],
        hiddenAddonSlugs: branch.hiddenAddonSlugs ?? [],
        hiddenGarmentItemIds: branch.hiddenGarmentItemIds ?? [],
      },
    };
  }

  async updateServicePricing(
    branchId: string,
    pricing: {
      serviceType: BookingType;
      basePricePerKg?: number;
      basePricePerLoad?: number;
      basePricePerPiece?: number;
      basePricePerPair?: number;
      basePricePerItem?: number;
      fixedPrice?: number;
      pricingUnit?: BranchPricingMode;
    }[],
    kgPerLoad?: number,
  ) {
    const rateKeyByUnit: Partial<Record<BranchPricingMode, RateKey>> = {
      [BranchPricingMode.PER_KG]: 'basePricePerKg',
      [BranchPricingMode.PER_LOAD]: 'basePricePerLoad',
      [BranchPricingMode.PER_PIECE]: 'basePricePerPiece',
      [BranchPricingMode.PER_PAIR]: 'basePricePerPair',
      [BranchPricingMode.PER_ITEM]: 'basePricePerItem',
      [BranchPricingMode.FIXED]: 'fixedPrice',
    };
    for (const row of pricing) {
      const rateKey = row.pricingUnit ? rateKeyByUnit[row.pricingUnit] : undefined;
      if (rateKey && row[rateKey] == null) {
        throw new BadRequestException(
          `Set a ${RATE_KEY_LABEL[rateKey]} rate before switching this service to that unit`,
        );
      }
    }
    // Atomic $set instead of load-then-save: this endpoint is fired alongside addon-pricing and
    // hidden-catalog updates in parallel from the partner-web save button, and load/save races on
    // Mongoose's version key when two of those land on the same document at once.
    const branch = await this.branchModel.findByIdAndUpdate(
      branchId,
      { $set: { servicePricing: pricing, ...(kgPerLoad !== undefined ? { kgPerLoad } : {}) } },
      { new: true },
    );
    if (!branch) throw new NotFoundException('Branch not found');
    return { success: true, data: await this.serializeShopPricing(branch) };
  }

  async updatePricingMode(branchId: string, pricingMode: BranchPricingMode) {
    const branch = await this.branchModel.findById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');
    const rateKeyByMode: Partial<Record<BranchPricingMode, RateKey>> = {
      [BranchPricingMode.PER_KG]: 'basePricePerKg',
      [BranchPricingMode.PER_LOAD]: 'basePricePerLoad',
      [BranchPricingMode.PER_PIECE]: 'basePricePerPiece',
      [BranchPricingMode.PER_PAIR]: 'basePricePerPair',
      [BranchPricingMode.PER_ITEM]: 'basePricePerItem',
      [BranchPricingMode.FIXED]: 'fixedPrice',
    };
    const rateKey = rateKeyByMode[pricingMode];
    if (rateKey) {
      const activeTypes = (await this.catalogService.listActiveServices())
        .map((s) => s.type)
        .filter((t) => !(branch.hiddenServiceTypes ?? []).includes(t));
      const missing = activeTypes.some((type) => {
        const rate = branch.servicePricing?.find((p) => p.serviceType === type)?.[rateKey];
        return rate == null;
      });
      if (missing) {
        throw new BadRequestException(
          `Set a ${RATE_KEY_LABEL[rateKey]} rate for every offered service before switching to this pricing mode`,
        );
      }
    }
    branch.pricingMode = pricingMode;
    await branch.save();
    return { success: true, data: { pricingMode: branch.pricingMode } };
  }

  async updateAddonPricing(
    branchId: string,
    pricing: {
      addonSlug: string;
      basePrice: number;
      basePricePerKg?: number;
      basePricePerLoad?: number;
      basePricePerPiece?: number;
      basePricePerPair?: number;
      basePricePerItem?: number;
      fixedPrice?: number;
      pricingUnit?: BranchPricingMode;
      applicableServiceTypes?: BookingType[];
      includedQuantity?: number;
    }[],
  ) {
    const rateKeyByUnit: Partial<Record<BranchPricingMode, RateKey>> = {
      [BranchPricingMode.PER_KG]: 'basePricePerKg',
      [BranchPricingMode.PER_LOAD]: 'basePricePerLoad',
      [BranchPricingMode.PER_PIECE]: 'basePricePerPiece',
      [BranchPricingMode.PER_PAIR]: 'basePricePerPair',
      [BranchPricingMode.PER_ITEM]: 'basePricePerItem',
      [BranchPricingMode.FIXED]: 'fixedPrice',
    };
    const activeAddons = await this.catalogService.listActiveAddons();
    const customAddons = await this.customAddonModel.find({ branchId: new Types.ObjectId(branchId) });
    const knownSlugs = new Set([
      ...activeAddons.map((a) => a.id),
      ...customAddons.map((c) => `${CUSTOM_ADDON_ID_PREFIX}${c.slug}`),
    ]);
    for (const row of pricing) {
      if (!knownSlugs.has(row.addonSlug)) {
        throw new BadRequestException(`Unknown add-on slug: ${row.addonSlug}`);
      }
      const rateKey = row.pricingUnit ? rateKeyByUnit[row.pricingUnit] : undefined;
      if (rateKey && row[rateKey] == null) {
        throw new BadRequestException(
          `Set a ${RATE_KEY_LABEL[rateKey]} rate before switching this add-on to that unit`,
        );
      }
    }
    const branch = await this.branchModel.findByIdAndUpdate(
      branchId,
      { $set: { addonPricing: pricing } },
      { new: true },
    );
    if (!branch) throw new NotFoundException('Branch not found');
    return { success: true, data: await this.serializeShopAddonPricing(branch) };
  }

  operationalBranchFilter(partnerUserId?: Types.ObjectId) {
    const filter: Record<string, unknown> = { isActive: true, branchType: { $ne: 'hq' as const } };
    if (partnerUserId) filter.partnerUserId = partnerUserId;
    return filter;
  }

  /**
   * Customers book before a shop is assigned (managed-network dispatch happens after payment),
   * so no single branch's hours apply yet. We take the union across every branch currently
   * accepting orders — a time slot is offered if at least one shop would be open for it.
   */
  async getUnionOperatingHours(): Promise<OperatingHours> {
    const branches = await this.branchModel
      .find({ ...this.operationalBranchFilter(), 'portalSettings.acceptingOrders': true })
      .select('operatingHours');

    if (branches.length === 0) return DEFAULT_OPERATING_HOURS;

    const union: DayOperatingHours[] = Array.from({ length: 7 }, () => ({
      isClosed: true,
      openTime: '00:00',
      closeTime: '00:00',
    }));

    for (const branch of branches) {
      const hours = branch.operatingHours?.length === 7 ? branch.operatingHours : DEFAULT_OPERATING_HOURS;
      hours.forEach((day, i) => {
        if (day.isClosed) return;
        union[i] = union[i].isClosed
          ? { isClosed: false, openTime: day.openTime, closeTime: day.closeTime }
          : {
              isClosed: false,
              // "HH:mm" zero-padded strings compare lexicographically like their numeric values.
              openTime: day.openTime < union[i].openTime ? day.openTime : union[i].openTime,
              closeTime: day.closeTime > union[i].closeTime ? day.closeTime : union[i].closeTime,
            };
      });
    }

    return union;
  }

  async ensureSeeded() {
    const partner = await this.userModel.findOne({ email: 'partner@lunara.dev' });
    if (!partner) return;

    const opCount = await this.branchModel.countDocuments({
      $or: [{ branchType: { $ne: 'hq' } }, { branchType: { $exists: false } }],
    });
    if (opCount > 0) return;

    for (const b of DEFAULT_BRANCHES) {
      await this.branchModel.create({
        code: b.code,
        name: b.name,
        branchType: 'partner_shop',
        line1: b.line1,
        city: b.city,
        province: b.province,
        partnerUserId: partner._id,
        managerUserId: partner._id,
        maxActiveOrders: b.maxActiveOrders,
        maxWeightCapacityKg: b.maxWeightCapacityKg,
        dailyQuotaOrders: b.maxActiveOrders,
        dailyQuotaWeightKg: b.maxWeightCapacityKg,
        serviceRadiusKm: b.serviceRadiusKm,
        isActive: true,
        location: { type: 'Point', coordinates: b.coordinates },
      });
    }
  }

  async listBranches() {
    await this.ensureSeeded();
    const branches = await this.branchModel
      .find(this.operationalBranchFilter())
      .sort({ name: 1 });
    const withCapacity = await Promise.all(
      branches.map(async (b) => this.serializeBranchWithCapacity(b)),
    );
    return { success: true, data: withCapacity };
  }

  /** All active branches including HQ — lightweight list for parent branch selectors. */
  async listParentBranches() {
    const branches = await this.branchModel
      .find({ isActive: true })
      .select('code name branchType city')
      .sort({ branchType: 1, name: 1 });
    return {
      success: true,
      data: branches.map((b) => ({
        _id: b._id.toString(),
        code: b.code,
        name: b.name,
        branchType: b.branchType,
        city: b.city,
      })),
    };
  }

  /** Marketing-safe listing for the public website — active branches only, no internal fields. */
  async listPublicBranches() {
    await this.ensureSeeded();
    const branches = await this.branchModel
      .find(this.operationalBranchFilter())
      .select('name city province serviceRadiusKm logoUrl partnerUserId isMainShop')
      .sort({ name: 1 });
    const ownerProfiles = await this.userProfileModel
      .find({ userId: { $in: branches.map((b) => b.partnerUserId) } })
      .select('userId displayName avatarUrl')
      .lean();
    const ownerByPartnerId = new Map(ownerProfiles.map((p) => [p.userId.toString(), p]));
    return {
      success: true,
      data: branches.map((b) => {
        const owner = ownerByPartnerId.get(b.partnerUserId.toString());
        return {
          ...this.toPublicBranch(b),
          partnerId: b.partnerUserId.toString(),
          partnerName: owner?.displayName,
          isMainShop: b.isMainShop,
        };
      }),
    };
  }

  /** Marketing-safe detail for a single branch — powers the public laundry-partner page. */
  async getPublicBranchById(id: string) {
    await this.ensureSeeded();
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Branch not found');
    }
    const branch = await this.branchModel
      .findOne({ _id: id, ...this.operationalBranchFilter() })
      .select('name city province serviceRadiusKm logoUrl partnerUserId');
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const [ownerProfile, staffUsers, siblingBranches] = await Promise.all([
      this.userProfileModel.findOne({ userId: branch.partnerUserId }).lean(),
      this.userModel
        .find({ branchId: branch._id, role: UserRole.STAFF, isActive: true })
        .select('_id')
        .lean(),
      this.branchModel
        .find({
          partnerUserId: branch.partnerUserId,
          _id: { $ne: branch._id },
          ...this.operationalBranchFilter(),
        })
        .select('name city province')
        .sort({ name: 1 })
        .lean(),
    ]);

    const staffProfiles = await this.userProfileModel
      .find({ userId: { $in: staffUsers.map((s) => s._id) } })
      .lean();

    return {
      success: true,
      data: {
        ...this.toPublicBranch(branch),
        owner:
          ownerProfile?.displayName || ownerProfile?.avatarUrl
            ? { displayName: ownerProfile.displayName, avatarUrl: ownerProfile.avatarUrl }
            : null,
        staff: staffProfiles
          .filter((p) => p.displayName || p.avatarUrl)
          .map((p) => ({ displayName: p.displayName, avatarUrl: p.avatarUrl })),
        branches: siblingBranches.map((b) => ({
          id: b._id.toString(),
          name: b.name,
          city: b.city,
          province: b.province,
        })),
      },
    };
  }

  private toPublicBranch(b: BranchDocument) {
    return {
      id: b._id.toString(),
      name: b.name,
      city: b.city,
      province: b.province,
      radiusKm: b.serviceRadiusKm,
      logoUrl: b.logoUrl,
    };
  }

  async findNearestForAddress(
    address: {
      city: string;
      latitude?: number;
      longitude?: number;
    },
    partnerUserId?: Types.ObjectId,
  ) {
    await this.ensureSeeded();
    const customerCoords = resolveCoordinates(
      address.city,
      address.latitude,
      address.longitude,
    );

    const branches = await this.branchModel.find(this.operationalBranchFilter(partnerUserId));
    if (branches.length === 0) {
      throw new BadRequestException('No laundry branches available');
    }

    const ranked = await Promise.all(
      branches.map(async (branch) => {
        const [lng, lat] = branch.location.coordinates;
        const dist = distanceKm(customerCoords, [lng, lat]);
        const activeOrders = await this.countActiveOrders(branch._id);
        const todaysOrders = await this.countTodaysOrders(branch._id);
        const capacityAvailable =
          activeOrders < branch.maxActiveOrders && todaysOrders < branch.dailyQuotaOrders;
        const withinRadius = dist <= branch.serviceRadiusKm;
        return {
          branch,
          distanceKm: dist,
          activeOrders,
          todaysOrders,
          capacityAvailable,
          withinRadius,
        };
      }),
    );

    ranked.sort((a, b) => a.distanceKm - b.distanceKm);

    return {
      customerCoordinates: { longitude: customerCoords[0], latitude: customerCoords[1] },
      ranked: ranked.map((r) => ({
        branchId: r.branch._id.toString(),
        code: r.branch.code,
        name: r.branch.name,
        city: r.branch.city,
        distanceKm: Math.round(r.distanceKm * 10) / 10,
        distanceLabel: formatDistanceKm(r.distanceKm),
        activeOrders: r.activeOrders,
        maxActiveOrders: r.branch.maxActiveOrders,
        todaysOrders: r.todaysOrders,
        dailyQuotaOrders: r.branch.dailyQuotaOrders,
        capacityAvailable: r.capacityAvailable,
        withinRadius: r.withinRadius,
        isNearest: false,
      })),
    };
  }

  async evaluatePartnerCoverageForAddress(address: {
    line1?: string;
    city: string;
    province: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
  }): Promise<PartnerCoverageInfo> {
    const area = await this.serviceAreasService.resolveAreaForAddress({
      line1: address.line1 ?? '',
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
    });

    if (!area.valid) {
      return buildPartnerCoverageNotice({
        inServiceArea: false,
        hasPartnerNearby: false,
        branchAssigned: false,
      });
    }

    await this.ensureSeeded();
    const branches = await this.branchModel.find(this.operationalBranchFilter());
    if (branches.length === 0) {
      return buildPartnerCoverageNotice({
        inServiceArea: true,
        hasPartnerNearby: false,
        branchAssigned: false,
      });
    }

    const nearest = await this.findNearestForAddress({
      city: address.city,
      latitude: address.latitude,
      longitude: address.longitude,
    });

    const hasPartnerNearby = nearest.ranked.some(
      (r) => r.withinRadius && r.capacityAvailable,
    );

    return buildPartnerCoverageNotice({
      inServiceArea: true,
      hasPartnerNearby,
      branchAssigned: false,
      nearestDistanceLabel: nearest.ranked[0]?.distanceLabel,
    });
  }

  async evaluatePartnerCoverageForAddressId(addressId: string) {
    const address = await this.addressModel.findById(addressId);
    if (!address) return null;
    return this.evaluatePartnerCoverageForAddress({
      line1: address.line1,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      latitude: address.latitude,
      longitude: address.longitude,
    });
  }

  async findNearestByAddressId(userId: string, addressId: string) {
    const address = await this.addressModel.findOne({
      _id: addressId,
      userId: new Types.ObjectId(userId),
    });
    if (!address) throw new NotFoundException('Address not found');

    const nearest = await this.findNearestForAddress({
      city: address.city,
      latitude: address.latitude,
      longitude: address.longitude,
    });
    if (nearest.ranked.length > 0) nearest.ranked[0].isNearest = true;

    return {
      success: true,
      data: {
        ...nearest,
        note: 'Branches shown for reference. Lunara operations assigns your shop after payment.',
      },
    };
  }

  async countPendingDispatch() {
    return this.orderModel.countDocuments({
      status: OrderStatus.PENDING_DISPATCH,
    });
  }

  async getBranchPerformance(branchId: Types.ObjectId) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const completed = await this.orderModel.find({
      branchId,
      status: { $in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
      updatedAt: { $gte: since },
    });

    const onTime = completed.filter((o) => {
      const due = o.slaPickupDueAt ?? o.scheduledPickupAt;
      const collected = o.pickup?.collectedAt;
      if (!collected || !due) return true;
      return collected.getTime() <= due.getTime() + 60 * 60 * 1000;
    });

    const onTimeRate =
      completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : 88;

    return scoreBranchPerformance(completed.length, onTimeRate);
  }

  async buildDispatchEvaluations(
    address: {
      line1: string;
      city: string;
      province: string;
      latitude?: number;
      longitude?: number;
    },
    bookingType: string,
    estimatedWeightKg: number,
    partnerUserId?: Types.ObjectId,
  ) {
    const nearest = await this.findNearestForAddress(address, partnerUserId);
    const branches = await this.branchModel.find(this.operationalBranchFilter(partnerUserId));

    // Unscoped (shared admin queue) evaluation: don't let an address inside another partner's
    // exclusive territory get ranked against branches that aren't that partner's.
    if (!partnerUserId) {
      const exclusiveOwnerIds = await this.partnerTerritoriesService.findExclusiveOwnerUserIdsContaining([
        nearest.customerCoordinates.longitude,
        nearest.customerCoordinates.latitude,
      ]);
      if (exclusiveOwnerIds.size > 0) {
        const allowedBranchIds = new Set(
          branches
            .filter((b) => exclusiveOwnerIds.has(b.partnerUserId.toString()))
            .map((b) => b._id.toString()),
        );
        nearest.ranked = nearest.ranked.filter((r) => allowedBranchIds.has(r.branchId));
      }
    }

    // Exclude shops that have opted out of this booking type (Branch.hiddenServiceTypes) —
    // dispatch (manual admin queue and autoDispatchOrder) must never route an order to a shop
    // that explicitly said it doesn't offer this service.
    const eligibility = await Promise.all(
      nearest.ranked.map(async (r) => {
        const branch = branches.find((b) => b._id.toString() === r.branchId);
        if (!branch) return true;
        return this.isServiceTypeOfferedByBranch(branch, bookingType as BookingType);
      }),
    );
    const eligibleRanked = nearest.ranked.filter((_, i) => eligibility[i]);

    const inputs = await Promise.all(
      eligibleRanked.map(async (r) => {
        const branch = branches.find((b) => b._id.toString() === r.branchId);
        const performance = branch
          ? await this.getBranchPerformance(branch._id)
          : scoreBranchPerformance(0, 85);

        return {
          branchId: r.branchId,
          code: r.code,
          name: r.name,
          city: r.city,
          distanceKm: r.distanceKm,
          distanceLabel: r.distanceLabel,
          withinRadius: r.withinRadius,
          activeOrders: r.activeOrders,
          maxActiveOrders: r.maxActiveOrders,
          capacityAvailable: r.capacityAvailable,
          isActive: branch?.isActive ?? true,
          performance,
          bookingType,
          estimatedWeightKg,
          customerLocation: {
            line1: address.line1,
            city: address.city,
            province: address.province,
            latitude: address.latitude,
            longitude: address.longitude,
          },
        };
      }),
    );

    return {
      customerLocation: {
        ...address,
        coordinates: nearest.customerCoordinates,
      },
      branchEvaluations: rankBranchesForDispatch(inputs),
    };
  }

  /**
   * Same ranking as buildDispatchEvaluations, scoped to a single partner's own branches —
   * used to auto-dispatch bookings placed through that partner's white-labeled app, which
   * must never enter the shared admin /dispatch queue.
   */
  async buildDispatchEvaluationsForPartner(
    address: {
      line1: string;
      city: string;
      province: string;
      latitude?: number;
      longitude?: number;
    },
    bookingType: string,
    estimatedWeightKg: number,
    partnerUserId: Types.ObjectId,
  ) {
    const territory = await this.partnerTerritoriesService.findByOwnerUserId(partnerUserId);
    if (territory) {
      const coords = resolveCoordinates(address.city, address.latitude, address.longitude);
      const inTerritory = this.partnerTerritoriesService.isAddressInTerritory(territory, coords);
      if (!inTerritory) {
        // Per Multi-tenant.md decision #3 — no fallback to the shared admin dispatch queue,
        // checkout must fail outright when the address is outside this partner's own turf.
        throw new BadRequestException(
          'This address is outside our delivery area for this shop. Please try a different address.',
        );
      }
    }
    return this.buildDispatchEvaluations(address, bookingType, estimatedWeightKg, partnerUserId);
  }

  async getDispatchQueue() {
    await this.ensureSeeded();
    const orders = await this.orderModel
      .find({
        status: OrderStatus.PENDING_DISPATCH,
      })
      .sort({ createdAt: 1 })
      .limit(100);

    const customers = await this.userModel
      .find({ _id: { $in: orders.map((o) => o.customerId) } })
      .select('email phone');

    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));

    const items = await Promise.all(
      orders.map(async (order) => {
        const address = await this.addressModel.findById(order.pickupAddressId);
        const evaluation = address
          ? await this.buildDispatchEvaluations(
              {
                line1: address.line1,
                city: address.city,
                province: address.province,
                latitude: address.latitude,
                longitude: address.longitude,
              },
              order.bookingType,
              order.estimatedWeightKg ?? 5,
            )
          : { customerLocation: null, branchEvaluations: [] };

        const recommended = evaluation.branchEvaluations.find((b) => b.isRecommended);

        return {
          _id: order._id.toString(),
          status: order.status,
          bookingType: order.bookingType,
          total: order.total,
          estimatedWeightKg: order.estimatedWeightKg,
          scheduledPickupAt: order.scheduledPickupAt,
          createdAt: order.createdAt,
          customerEmail: customerMap.get(order.customerId.toString())?.email,
          pickupAddress: address
            ? {
                line1: address.line1,
                city: address.city,
                province: address.province,
                latitude: address.latitude,
                longitude: address.longitude,
              }
            : null,
          customerLocation: evaluation.customerLocation,
          branchEvaluations: evaluation.branchEvaluations,
          recommendedBranchId: recommended?.branchId,
        };
      }),
    );

    return { success: true, data: { items, pendingCount: items.length } };
  }

  async getDispatchSuggestions(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PENDING_DISPATCH) {
      throw new BadRequestException('Order is not awaiting dispatch');
    }

    const address = await this.addressModel.findById(order.pickupAddressId);
    if (!address) throw new NotFoundException('Pickup address not found');

    const evaluation = await this.buildDispatchEvaluations(
      {
        line1: address.line1,
        city: address.city,
        province: address.province,
        latitude: address.latitude,
        longitude: address.longitude,
      },
      order.bookingType,
      order.estimatedWeightKg ?? 5,
    );

    return {
      success: true,
      data: {
        orderId: order._id.toString(),
        pickupAddress: {
          line1: address.line1,
          city: address.city,
          province: address.province,
        },
        customerLocation: evaluation.customerLocation,
        branchEvaluations: evaluation.branchEvaluations,
        evaluationCriteria: [
          'customer_location',
          'shop_capacity',
          'shop_performance',
          'shop_availability',
          'estimated_turnaround',
        ],
      },
    };
  }

  /**
   * Mutates and saves the order with shop-assignment fields, pushes status history,
   * and fires the tracking/dispatch websocket events. Shared by the admin manual-assign
   * path (adminDispatchOrder) and the partner auto-dispatch path (payments.service.ts
   * confirmOrder), which both end in the same SHOP_ASSIGNED state.
   */
  async applyShopAssignment(
    order: OrderDocument,
    branch: BranchDocument,
    opts: { dispatchedByUserId?: string; activeOrders: number; noteOverride?: string } = {
      activeOrders: 0,
    },
  ) {
    order.branchId = branch._id;
    order.branchCode = branch.code;
    order.branchName = branch.name;
    order.partnerId = branch.partnerUserId;
    const turnaround = estimateTurnaroundHours(
      order.bookingType,
      order.estimatedWeightKg ?? 5,
      opts.activeOrders,
    );

    order.status = OrderStatus.SHOP_ASSIGNED;
    order.dispatchStatus = 'dispatched';
    order.dispatchedAt = new Date();
    if (opts.dispatchedByUserId) order.dispatchedBy = new Types.ObjectId(opts.dispatchedByUserId);
    order.slaPickupDueAt = order.scheduledPickupAt;
    order.estimatedTurnaroundHours = turnaround.hours;
    order.statusHistory.push({
      status: OrderStatus.SHOP_ASSIGNED,
      timestamp: new Date(),
      note: opts.noteOverride ?? `Shop assigned: ${branch.name} (ETA ${turnaround.label})`,
    });

    const autoAccepted = branch.portalSettings?.autoAcceptIncoming === true;
    if (autoAccepted) {
      order.partnerAcceptedAt = new Date();
      order.statusHistory.push({
        status: order.status,
        timestamp: new Date(),
        note: 'Auto-accepted per shop settings',
      });
    }

    await order.save();

    const orderId = order._id.toString();
    this.trackingGateway.emitOrderEvent(orderId, 'shopAssigned', {
      message: `Assigned to ${branch.name} — estimated turnaround ${turnaround.label}`,
      branchId: branch._id.toString(),
      branchName: branch.name,
    });
    if (autoAccepted) {
      this.trackingGateway.emitOrderEvent(orderId, 'partnerAccepted', {
        message: `${branch.name} accepted your order`,
      });
      await this.riderAssignmentService
        .autoAssignPickupRiderIfConfigured(orderId)
        .catch(() => {});
    }
    this.trackingGateway.emitDispatchQueueUpdated({
      reason: 'shop_assigned',
      orderId,
    });
    this.trackingGateway.emitPartnerPipelineUpdated({
      orderId,
      status: order.status,
      partnerId: order.partnerId?.toString(),
      branchId: order.branchId?.toString(),
    });

    return turnaround;
  }

  async adminDispatchOrder(orderId: string, branchId: string, adminUserId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== OrderStatus.PENDING_DISPATCH) {
      throw new BadRequestException('Only pending-dispatch (paid) orders can be assigned to a shop');
    }
    if (order.branchId) {
      throw new BadRequestException('Order already dispatched to a branch');
    }

    const branch = await this.branchModel.findById(branchId);
    if (!branch || !branch.isActive || branch.branchType === 'hq') {
      throw new NotFoundException('Branch not found');
    }

    const offered = await this.isServiceTypeOfferedByBranch(branch, order.bookingType);
    if (!offered) {
      throw new BadRequestException(`${branch.name} does not offer this service type`);
    }

    const activeOrders = await this.countActiveOrders(branch._id);
    if (activeOrders >= branch.maxActiveOrders) {
      throw new BadRequestException(
        `${branch.name} is at capacity (${activeOrders}/${branch.maxActiveOrders})`,
      );
    }

    const todaysOrders = await this.countTodaysOrders(branch._id);
    if (todaysOrders >= branch.dailyQuotaOrders) {
      throw new BadRequestException(
        `${branch.name} has reached its daily order limit (${todaysOrders}/${branch.dailyQuotaOrders})`,
      );
    }

    const turnaround = await this.applyShopAssignment(order, branch, {
      dispatchedByUserId: adminUserId,
      activeOrders,
    });

    return {
      success: true,
      data: {
        orderId: order._id.toString(),
        status: order.status,
        branchId: branch._id.toString(),
        branchCode: branch.code,
        branchName: branch.name,
        partnerUserId: branch.partnerUserId.toString(),
        estimatedTurnaroundHours: order.estimatedTurnaroundHours,
        estimatedTurnaroundLabel: turnaround.label,
        dispatchStatus: order.dispatchStatus,
        dispatchedAt: order.dispatchedAt,
      },
    };
  }

  /**
   * Automation counterpart to adminDispatchOrder: assigns the top-ranked, capacity-available
   * branch with no admin action. Gated behind the autoDispatchOrders platform setting — callers
   * must check that flag before invoking this. Leaves the order in PENDING_DISPATCH (for the
   * admin queue) if no branch is currently accepting orders.
   */
  async autoDispatchOrder(order: OrderDocument) {
    if (order.status !== OrderStatus.PENDING_DISPATCH || order.branchId) return null;

    const address = await this.addressModel.findById(order.pickupAddressId);
    if (!address) return null;

    const evaluation = await this.buildDispatchEvaluations(
      {
        line1: address.line1,
        city: address.city,
        province: address.province,
        latitude: address.latitude,
        longitude: address.longitude,
      },
      order.bookingType,
      order.estimatedWeightKg ?? 5,
    );

    // Automated dispatch must only land on algorithmically-qualified branches (see
    // isQualityQualified) — capacity alone isn't enough when no human is picking the shop.
    const top = evaluation.branchEvaluations.find(
      (b) => b.availability.acceptingOrders && b.qualified,
    );
    if (!top) return null;

    const branch = await this.branchModel.findById(top.branchId);
    if (!branch) return null;

    const activeOrders = await this.countActiveOrders(branch._id);
    if (activeOrders >= branch.maxActiveOrders) return null;

    const todaysOrders = await this.countTodaysOrders(branch._id);
    if (todaysOrders >= branch.dailyQuotaOrders) return null;

    const turnaround = await this.applyShopAssignment(order, branch, {
      activeOrders,
      noteOverride: `Auto-dispatched to ${branch.name} (ETA ${estimateTurnaroundHours(order.bookingType, order.estimatedWeightKg ?? 5, activeOrders).label})`,
    });

    return { branch, turnaround };
  }

  /**
   * Finalizes a partner auto-dispatch that was pre-resolved at booking time (booking.service.ts
   * already picked the branch and stored branchId/partnerId on the order before payment).
   * Capacity is not re-checked as a hard gate here — checkout already blocked the booking if the
   * partner had no available branch, and money has already been captured by this point.
   */
  async finalizePreResolvedShopAssignment(order: OrderDocument) {
    if (!order.branchId) return;
    const branch = await this.branchModel.findById(order.branchId);
    if (!branch) return;

    const activeOrders = await this.countActiveOrders(branch._id);
    await this.applyShopAssignment(order, branch, {
      activeOrders,
      noteOverride: `Payment confirmed — auto-dispatched to partner shop ${branch.name}`,
    });
  }

  /** Batch-fetch logoUrl for a set of branch ids, keyed by string id. Used to enrich order responses. */
  async getLogoUrlsByIds(branchIds: Types.ObjectId[]): Promise<Map<string, string | undefined>> {
    if (branchIds.length === 0) return new Map();
    const branches = await this.branchModel.find({ _id: { $in: branchIds } }).select('logoUrl');
    return new Map(branches.map((b) => [b._id.toString(), b.logoUrl]));
  }

  async getBranch(id: string) {
    const branch = await this.branchModel.findById(id);
    if (!branch) throw new NotFoundException('Branch not found');
    return { success: true, data: await this.serializeBranchWithCapacity(branch) };
  }

  async countActiveOrdersForBranch(branchId: Types.ObjectId) {
    return this.countActiveOrders(branchId);
  }

  async sumBranchWeightLoadKg(branchId: Types.ObjectId) {
    return this.sumBranchWeightLoadKgInternal(branchId);
  }

  /** Real count of orders already scheduled into each hourly pickup window for this branch, keyed
   * by that window's startAt ISO string — used to mark pickup slots full instead of guessing. */
  async getScheduledPickupCounts(
    branchId: Types.ObjectId,
    from: Date,
    to: Date,
  ): Promise<Record<string, number>> {
    const rows = await this.orderModel.aggregate<{ _id: Date; count: number }>([
      {
        $match: {
          branchId,
          scheduledPickupAt: { $gte: from, $lt: to },
          status: { $ne: OrderStatus.CANCELLED },
        },
      },
      { $group: { _id: '$scheduledPickupAt', count: { $sum: 1 } } },
    ]);
    const counts: Record<string, number> = {};
    for (const row of rows) counts[new Date(row._id).toISOString()] = row.count;
    return counts;
  }

  /** Once a shop is chosen (customer-picked or Lunara-dispatched), pickup times must reflect that
   * shop's own hours and holidays (stricter and authoritative); otherwise fall back to the union of
   * every active branch's hours, with no holiday filtering (white-labeled / not-yet-chosen flow —
   * no single shop's holiday calendar applies yet). Shared by booking (new orders) and order
   * rescheduling so both agree on what's bookable. */
  async resolvePickupSchedule(branchId?: string) {
    if (!branchId) {
      return { operatingHours: await this.getUnionOperatingHours(), holidays: [] as BranchHoliday[] };
    }
    const branch = await this.getActivePartnerShop(branchId);
    const holidays = await this.resolveBranchHolidays(branch);
    return { operatingHours: branch.operatingHours, holidays, branch };
  }

  /** Real per-hour capacity for a specific branch, computed from its actual scheduled pickups
   * against its own daily order quota — undefined when no branch has been chosen yet, since there's
   * nothing real to check availability against (times are then all treated as available). */
  async resolvePickupCapacity(
    branch: Awaited<ReturnType<BranchesService['getActivePartnerShop']>> | undefined,
    operatingHours: OperatingHours,
    fromDate: Date,
    days: number,
  ) {
    if (!branch) return undefined;
    const to = new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
    const bookedBySlot = await this.getScheduledPickupCounts(branch._id as Types.ObjectId, fromDate, to);
    const perSlot = estimateSlotCapacityPerHour(branch.dailyQuotaOrders, operatingHours);
    return { perSlot, bookedBySlot };
  }

  /** Single entry point for "is this arbitrary customer-chosen pickup time actually bookable" —
   * used by both new-booking submission and order rescheduling so they enforce the same rules
   * (operating hours, holidays, minimum lead time, real per-hour capacity). */
  async validatePickupTimeForBranch(branchId: string | undefined, scheduledPickupAt: string) {
    const { operatingHours, holidays, branch } = await this.resolvePickupSchedule(branchId);
    const capacity = await this.resolvePickupCapacity(
      branch,
      operatingHours,
      new Date(),
      PICKUP_SCHEDULE_DAY_COUNT,
    );
    return validatePickupTime(scheduledPickupAt, operatingHours, holidays, new Date(), capacity);
  }

  private async countActiveOrders(branchId: Types.ObjectId) {
    return this.orderModel.countDocuments({
      branchId,
      status: { $in: CAPACITY_STATUSES },
    });
  }

  /** Orders assigned to this branch since local midnight — enforces the fixed daily quota
   * independently of maxActiveOrders (a branch can free up concurrent slots by completing
   * orders while still having hit its real daily ceiling). */
  private async countTodaysOrders(branchId: Types.ObjectId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return this.orderModel.countDocuments({
      branchId,
      dispatchedAt: { $gte: startOfDay },
    });
  }

  private async sumBranchWeightLoadKgInternal(branchId: Types.ObjectId) {
    const rows = await this.orderModel.aggregate([
      {
        $match: {
          branchId,
          status: { $in: CAPACITY_STATUSES },
        },
      },
      {
        $group: {
          _id: null,
          totalKg: {
            $sum: {
              $ifNull: [
                '$laundryProcessing.verifiedWeightKg',
                { $ifNull: ['$shopReceiving.verifiedWeightKg', { $ifNull: ['$estimatedWeightKg', 5] }] },
              ],
            },
          },
        },
      },
    ]);
    return Math.round((rows[0]?.totalKg ?? 0) * 10) / 10;
  }

  async getShopCapacityBoard() {
    await this.ensureSeeded();
    const branches = await this.branchModel
      .find(this.operationalBranchFilter())
      .sort({ name: 1 });
    const rows = await Promise.all(
      branches.map(async (b) => {
        const currentLoadKg = await this.sumBranchWeightLoadKgInternal(b._id);
        const todaysOrders = await this.countTodaysOrders(b._id);
        const capacityKg = b.maxWeightCapacityKg ?? 200;
        const utilizationPercent =
          capacityKg > 0 ? Math.min(100, Math.round((currentLoadKg / capacityKg) * 100)) : 0;
        const dailyOrderUtilizationPercent =
          b.dailyQuotaOrders > 0
            ? Math.min(100, Math.round((todaysOrders / b.dailyQuotaOrders) * 100))
            : 0;
        return {
          branchId: b._id.toString(),
          shop: b.name,
          code: b.code,
          city: b.city,
          capacityKg,
          currentLoadKg,
          utilizationPercent,
          todaysOrders,
          dailyQuotaOrders: b.dailyQuotaOrders,
          dailyOrderUtilizationPercent,
          isAtDailyQuota: todaysOrders >= b.dailyQuotaOrders,
          headroomKg: Math.max(0, Math.round((capacityKg - currentLoadKg) * 10) / 10),
          isOverCapacity: currentLoadKg >= capacityKg,
        };
      }),
    );
    return { success: true, data: { shops: rows } };
  }

  private async serializeBranchWithCapacity(branch: BranchDocument) {
    const activeOrders = await this.countActiveOrders(branch._id);
    const todaysOrders = await this.countTodaysOrders(branch._id);
    const currentLoadKg = await this.sumBranchWeightLoadKgInternal(branch._id);
    const capacityKg = branch.maxWeightCapacityKg ?? 200;
    return {
      _id: branch._id.toString(),
      code: branch.code,
      name: branch.name,
      branchType: branch.branchType ?? 'partner_shop',
      parentBranchId: branch.parentBranchId?.toString(),
      line1: branch.line1,
      city: branch.city,
      province: branch.province,
      partnerUserId: branch.partnerUserId.toString(),
      managerUserId: branch.managerUserId?.toString(),
      assignedRiderId: branch.assignedRiderId?.toString(),
      maxActiveOrders: branch.maxActiveOrders,
      maxWeightCapacityKg: capacityKg,
      dailyQuotaOrders: branch.dailyQuotaOrders,
      dailyQuotaWeightKg: branch.dailyQuotaWeightKg,
      currentLoadKg,
      serviceRadiusKm: branch.serviceRadiusKm,
      activeOrders,
      todaysOrders,
      capacityAvailable:
        activeOrders < branch.maxActiveOrders && todaysOrders < branch.dailyQuotaOrders,
      dailyQuotaAvailable: todaysOrders < branch.dailyQuotaOrders,
      weightCapacityAvailable: currentLoadKg < capacityKg,
      location: {
        longitude: branch.location.coordinates[0],
        latitude: branch.location.coordinates[1],
      },
    };
  }
}
