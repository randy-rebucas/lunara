import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { isMetroManilaAddress } from '@lunara/utils';
import { PlatformSettings, PlatformSettingsDocument } from './schemas/platform-settings.schema';
import { UpdateDeliveryFeeDto } from './dto/update-delivery-fee.dto';

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
        cityDeliveryFee: settings.cityDeliveryFee,
        provinceDeliveryFee: settings.provinceDeliveryFee,
      },
    };
  }

  async updateDeliveryFeeSettings(dto: UpdateDeliveryFeeDto) {
    const settings = await this.getOrCreateSettings();
    if (dto.cityDeliveryFee !== undefined) settings.cityDeliveryFee = dto.cityDeliveryFee;
    if (dto.provinceDeliveryFee !== undefined) {
      settings.provinceDeliveryFee = dto.provinceDeliveryFee;
    }
    await settings.save();
    return {
      success: true,
      data: {
        cityDeliveryFee: settings.cityDeliveryFee,
        provinceDeliveryFee: settings.provinceDeliveryFee,
      },
    };
  }

  /** Resolves the delivery fee for an address by its city/province tier. */
  async getDeliveryFeeForAddress(address: { city: string; province: string }) {
    const settings = await this.getOrCreateSettings();
    return isMetroManilaAddress(address)
      ? settings.cityDeliveryFee
      : settings.provinceDeliveryFee;
  }
}
