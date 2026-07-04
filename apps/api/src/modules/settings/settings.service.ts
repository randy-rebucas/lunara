import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PlatformSettings, PlatformSettingsDocument } from './schemas/platform-settings.schema';
import { UpdateDeliveryFeeDto } from './dto/update-delivery-fee.dto';
import { UpdateAutomationSettingsDto } from './dto/update-automation-settings.dto';
import { UpdateRiderFeesDto } from './dto/update-rider-fees.dto';

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
      },
    };
  }

  async updateDeliveryFeeSettings(dto: UpdateDeliveryFeeDto) {
    const settings = await this.getOrCreateSettings();
    if (dto.deliveryFee !== undefined) settings.deliveryFee = dto.deliveryFee;
    await settings.save();
    return {
      success: true,
      data: {
        deliveryFee: settings.deliveryFee,
      },
    };
  }

  /** Flat delivery fee — same for every address. */
  async getDeliveryFeeForAddress(_address: { city: string; province: string }) {
    const settings = await this.getOrCreateSettings();
    return settings.deliveryFee;
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
}
