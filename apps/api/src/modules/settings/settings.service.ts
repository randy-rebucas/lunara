import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { calculateDeliveryFee } from '@lunara/utils';
import { PlatformSettings, PlatformSettingsDocument } from './schemas/platform-settings.schema';
import { UpdateDeliveryFeeDto } from './dto/update-delivery-fee.dto';
import { UpdateAutomationSettingsDto } from './dto/update-automation-settings.dto';
import { UpdateRiderFeesDto } from './dto/update-rider-fees.dto';
import { UpdateAppVersionSettingsDto } from './dto/update-app-version-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(PlatformSettings.name)
    private settingsModel: Model<PlatformSettingsDocument>,
  ) {}

  async getOrCreateSettings() {
    const existing = await this.settingsModel.findOne();
    if (existing) return existing;
    return this.settingsModel.create({});
  }

  async getDeliveryFeeSettings() {
    const settings = await this.getOrCreateSettings();
    return {
      success: true,
      data: {
        deliveryFee: settings.deliveryFee,
        deliveryBaseDistanceKm: settings.deliveryBaseDistanceKm,
        deliveryPerKmRate: settings.deliveryPerKmRate,
        maxDeliveryRadiusKm: settings.maxDeliveryRadiusKm,
      },
    };
  }

  async updateDeliveryFeeSettings(dto: UpdateDeliveryFeeDto) {
    const settings = await this.getOrCreateSettings();
    if (dto.deliveryFee !== undefined) settings.deliveryFee = dto.deliveryFee;
    if (dto.deliveryBaseDistanceKm !== undefined)
      settings.deliveryBaseDistanceKm = dto.deliveryBaseDistanceKm;
    if (dto.deliveryPerKmRate !== undefined) settings.deliveryPerKmRate = dto.deliveryPerKmRate;
    if (dto.maxDeliveryRadiusKm !== undefined) settings.maxDeliveryRadiusKm = dto.maxDeliveryRadiusKm;
    await settings.save();
    return {
      success: true,
      data: {
        deliveryFee: settings.deliveryFee,
        deliveryBaseDistanceKm: settings.deliveryBaseDistanceKm,
        deliveryPerKmRate: settings.deliveryPerKmRate,
        maxDeliveryRadiusKm: settings.maxDeliveryRadiusKm,
      },
    };
  }

  /** Platform-wide delivery distance ceiling — beyond this, checkout is blocked outright regardless
   * of branch. Used alongside a branch's own serviceRadiusKm to decide when an order needs manual
   * admin approval instead of being auto-dispatched. */
  async getMaxDeliveryRadiusKm(): Promise<number> {
    const settings = await this.getOrCreateSettings();
    return settings.maxDeliveryRadiusKm;
  }

  /** Delivery Fee = base fare + (chargeable distance beyond the base allowance x per-km rate).
   * Pass the pickup-to-shop distance in km; omit it (e.g. for pre-shop-selection previews) to get
   * the flat base fare only. */
  async getDeliveryFeeForAddress(
    _address: { city: string; province: string },
    distanceKm?: number,
  ) {
    const settings = await this.getOrCreateSettings();
    if (distanceKm === undefined) return settings.deliveryFee;
    return calculateDeliveryFee(
      distanceKm,
      settings.deliveryFee,
      settings.deliveryBaseDistanceKm,
      settings.deliveryPerKmRate,
    );
  }

  /** Rates behind getDeliveryFeeForAddress, for surfacing the fee breakdown to customers
   * (e.g. "₱70 base + ₱8/km beyond 3km"). */
  async getDeliveryFeeRates() {
    const settings = await this.getOrCreateSettings();
    return {
      baseFee: settings.deliveryFee,
      baseDistanceKm: settings.deliveryBaseDistanceKm,
      perKmRate: settings.deliveryPerKmRate,
    };
  }

  async getRiderFeeSettings() {
    const settings = await this.getOrCreateSettings();
    return {
      success: true,
      data: {
        riderPickupFee: settings.riderPickupFee,
        riderDeliveryFee: settings.riderDeliveryFee,
      },
    };
  }

  async updateRiderFeeSettings(dto: UpdateRiderFeesDto) {
    const settings = await this.getOrCreateSettings();
    if (dto.riderPickupFee !== undefined) settings.riderPickupFee = dto.riderPickupFee;
    if (dto.riderDeliveryFee !== undefined) settings.riderDeliveryFee = dto.riderDeliveryFee;
    await settings.save();
    return {
      success: true,
      data: {
        riderPickupFee: settings.riderPickupFee,
        riderDeliveryFee: settings.riderDeliveryFee,
      },
    };
  }

  /** Configured flat rider fees, used by rider earning/netting logic. */
  async getRiderFeeAmounts(): Promise<{ pickup: number; delivery: number }> {
    const settings = await this.getOrCreateSettings();
    return { pickup: settings.riderPickupFee, delivery: settings.riderDeliveryFee };
  }

  private automationFields(settings: PlatformSettingsDocument) {
    return {
      autoDispatchOrders: settings.autoDispatchOrders,
      autoAssignPickupRider: settings.autoAssignPickupRider,
      autoAssignDeliveryRider: settings.autoAssignDeliveryRider,
      autoGenerateSettlements: settings.autoGenerateSettlements,
      autoApproveRefunds: settings.autoApproveRefunds,
      autoApproveRefundsThreshold: settings.autoApproveRefundsThreshold,
      autoApproveWithdrawals: settings.autoApproveWithdrawals,
      autoApproveWithdrawalsThreshold: settings.autoApproveWithdrawalsThreshold,
      weeklyStatsEnabled: settings.weeklyStatsEnabled,
      weeklyStatsPhone: settings.weeklyStatsPhone,
      weeklyStatsEmail: settings.weeklyStatsEmail,
    };
  }

  async getAutomationSettings() {
    const settings = await this.getOrCreateSettings();
    return { success: true, data: this.automationFields(settings) };
  }

  async updateAutomationSettings(dto: UpdateAutomationSettingsDto) {
    const settings = await this.getOrCreateSettings();
    // Only assign fields actually present in the request — class-validator instantiates every
    // declared DTO property (even ones the client omitted) as an explicit `undefined`, and
    // Object.assign-ing that onto a Mongoose document unsets the field on save.
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (settings as unknown as Record<string, unknown>)[key] = value;
      }
    }
    await settings.save();
    return { success: true, data: this.automationFields(settings) };
  }

  private appVersionFields(settings: PlatformSettingsDocument) {
    return {
      customerMinAppVersion: settings.customerMinAppVersion,
      customerLatestAppVersion: settings.customerLatestAppVersion,
      customerIosStoreUrl: settings.customerIosStoreUrl,
      customerAndroidStoreUrl: settings.customerAndroidStoreUrl,
      riderMinAppVersion: settings.riderMinAppVersion,
      riderLatestAppVersion: settings.riderLatestAppVersion,
      riderIosStoreUrl: settings.riderIosStoreUrl,
      riderAndroidStoreUrl: settings.riderAndroidStoreUrl,
    };
  }

  async getAppVersionSettings() {
    const settings = await this.getOrCreateSettings();
    return { success: true, data: this.appVersionFields(settings) };
  }

  async updateAppVersionSettings(dto: UpdateAppVersionSettingsDto) {
    const settings = await this.getOrCreateSettings();
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        (settings as unknown as Record<string, unknown>)[key] = value;
      }
    }
    await settings.save();
    return { success: true, data: this.appVersionFields(settings) };
  }

  /** Public, unauthenticated lookup used by the mobile apps' launch-time version gate. */
  async getAppVersionForApp(app: 'customer' | 'rider') {
    const settings = await this.getOrCreateSettings();
    if (app === 'customer') {
      return {
        minVersion: settings.customerMinAppVersion,
        latestVersion: settings.customerLatestAppVersion,
        iosStoreUrl: settings.customerIosStoreUrl,
        androidStoreUrl: settings.customerAndroidStoreUrl,
      };
    }
    return {
      minVersion: settings.riderMinAppVersion,
      latestVersion: settings.riderLatestAppVersion,
      iosStoreUrl: settings.riderIosStoreUrl,
      androidStoreUrl: settings.riderAndroidStoreUrl,
    };
  }

  /** Whether a given automation toggle is currently enabled. Used by services to gate auto-decisions. */
  async isAutomationEnabled(
    key:
      | 'autoDispatchOrders'
      | 'autoAssignPickupRider'
      | 'autoAssignDeliveryRider'
      | 'autoGenerateSettlements'
      | 'autoApproveRefunds'
      | 'autoApproveWithdrawals',
  ) {
    const settings = await this.getOrCreateSettings();
    return Boolean(settings[key]);
  }

  /** Enabled flag + peso threshold for a threshold-gated auto-approve toggle. */
  async getAutoApproveConfig(key: 'autoApproveRefunds' | 'autoApproveWithdrawals') {
    const settings = await this.getOrCreateSettings();
    const thresholdKey = `${key}Threshold` as 'autoApproveRefundsThreshold' | 'autoApproveWithdrawalsThreshold';
    return { enabled: Boolean(settings[key]), threshold: settings[thresholdKey] };
  }

  /** Admin contact email used for real-time event notices (new order/application/ticket/message).
   *  Reuses the weekly-stats email contact configured in Automation Settings — the only admin
   *  notification email address currently stored. Returns '' if none is configured. */
  async getAdminNotificationEmail(): Promise<string> {
    const settings = await this.getOrCreateSettings();
    return settings.weeklyStatsEmail ?? '';
  }

  /** Enabled flag + destination contacts for the weekly SMS/email stats summary. */
  async getWeeklyStatsConfig() {
    const settings = await this.getOrCreateSettings();
    return {
      enabled: settings.weeklyStatsEnabled,
      phone: settings.weeklyStatsPhone,
      email: settings.weeklyStatsEmail,
    };
  }
}
