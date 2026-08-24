import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import type { BookingAddonOption, LaundryServiceOption } from '@lunara/utils';

import { Model } from 'mongoose';

import { defaultAddonImageUrl, writeCatalogAddonImages } from './catalog-addon-images';
import { DEFAULT_LAUNDRY_ADDONS, DEFAULT_LAUNDRY_SERVICES } from './catalog.seed';

import { LaundryAddon, LaundryAddonDocument } from './schemas/laundry-addon.schema';

import { LaundryService, LaundryServiceDocument } from './schemas/laundry-service.schema';



@Injectable()

export class CatalogService {

  constructor(

    @InjectModel(LaundryService.name)

    private laundryServiceModel: Model<LaundryServiceDocument>,

    @InjectModel(LaundryAddon.name)

    private laundryAddonModel: Model<LaundryAddonDocument>,

  ) {}



  async ensureSeeded() {

    const count = await this.laundryServiceModel.countDocuments();

    if (count === 0) await this.laundryServiceModel.insertMany(DEFAULT_LAUNDRY_SERVICES);

  }



  async ensureAddonsSeeded() {
    const count = await this.laundryAddonModel.countDocuments();
    if (count > 0) return;
    writeCatalogAddonImages(DEFAULT_LAUNDRY_ADDONS.map((a) => a.slug));
    await this.laundryAddonModel.insertMany(
      DEFAULT_LAUNDRY_ADDONS.map((addon) => ({
        ...addon,
        imageUrl: defaultAddonImageUrl(addon.slug),
      })),
    );
  }



  async reseedDefaults() {

    const now = new Date();

    for (const service of DEFAULT_LAUNDRY_SERVICES) {

      await this.laundryServiceModel.updateOne(

        { type: service.type },

        {

          $set: { ...service, updatedAt: now },

          $setOnInsert: { createdAt: now },

        },

        { upsert: true },

      );

    }

    for (const addon of DEFAULT_LAUNDRY_ADDONS) {

      await this.laundryAddonModel.updateOne(

        { slug: addon.slug },

        {

          $set: { ...addon, updatedAt: now },

          $setOnInsert: { createdAt: now, imageUrl: defaultAddonImageUrl(addon.slug) },

        },

        { upsert: true },

      );

    }

  }



  private toServiceOption(doc: LaundryServiceDocument): LaundryServiceOption {

    return {

      type: doc.type,

      label: doc.label,

      description: doc.description,

      category: doc.category,

      pricePerKg: doc.pricePerKg,

      minWeightKg: doc.minWeightKg,

    };

  }



  private toAddonOption(doc: LaundryAddonDocument): BookingAddonOption {

    return {

      id: doc.slug,

      label: doc.label,

      description: doc.description,

      category: doc.category,

      price: doc.price,

      isPercentOfService: doc.isPercentOfService,

      imageUrl: doc.imageUrl,

      allowsQuantity: doc.allowsQuantity,

      maxQuantity: doc.maxQuantity,

    };

  }



  private serializeService(doc: LaundryServiceDocument) {

    return {

      _id: doc._id.toString(),

      type: doc.type,

      label: doc.label,

      description: doc.description,

      category: doc.category,

      pricePerKg: doc.pricePerKg,

      minWeightKg: doc.minWeightKg,

      isActive: doc.isActive,

      sortOrder: doc.sortOrder,

      createdAt: doc.createdAt,

      updatedAt: doc.updatedAt,

    };

  }



  private serializeAddon(doc: LaundryAddonDocument) {

    return {

      _id: doc._id.toString(),

      slug: doc.slug,

      label: doc.label,

      description: doc.description,

      category: doc.category,

      price: doc.price,

      imageUrl: doc.imageUrl,

      isActive: doc.isActive,

      sortOrder: doc.sortOrder,

      createdAt: doc.createdAt,

      updatedAt: doc.updatedAt,

    };

  }



  async listActiveServices(): Promise<LaundryServiceOption[]> {

    await this.ensureSeeded();

    const items = await this.laundryServiceModel

      .find({ isActive: true })

      .sort({ sortOrder: 1, label: 1 });

    return items.map((doc) => this.toServiceOption(doc));

  }



  async findActiveByType(type: string) {

    await this.ensureSeeded();

    const doc = await this.laundryServiceModel.findOne({ type, isActive: true });

    return doc ? this.toServiceOption(doc) : null;

  }



  async findActiveAddonBySlug(slug: string) {

    await this.ensureAddonsSeeded();

    const doc = await this.laundryAddonModel.findOne({ slug, isActive: true });

    return doc ? this.toAddonOption(doc) : null;

  }



  async listAllServices() {

    await this.ensureSeeded();

    const items = await this.laundryServiceModel.find().sort({ sortOrder: 1, label: 1 });

    return items.map((doc) => this.serializeService(doc));

  }



  async updateService(

    id: string,

    dto: Partial<{

      label: string;

      description: string;

      category: LaundryServiceDocument['category'];

      pricePerKg: number;

      minWeightKg: number;

      isActive: boolean;

      sortOrder: number;

    }>,

  ) {

    const service = await this.laundryServiceModel.findById(id);

    if (!service) throw new NotFoundException('Service not found');

    if (dto.label) service.label = dto.label.trim();

    if (dto.description != null) service.description = dto.description.trim();

    if (dto.category != null) service.category = dto.category;

    if (dto.pricePerKg != null) service.pricePerKg = dto.pricePerKg;

    if (dto.minWeightKg != null) service.minWeightKg = dto.minWeightKg;

    if (dto.isActive != null) service.isActive = dto.isActive;

    if (dto.sortOrder != null) service.sortOrder = dto.sortOrder;

    await service.save();

    return { success: true, data: this.serializeService(service) };

  }



  async listActiveAddons(): Promise<BookingAddonOption[]> {

    await this.ensureAddonsSeeded();

    const items = await this.laundryAddonModel

      .find({ isActive: true })

      .sort({ sortOrder: 1, label: 1 });

    return items.map((doc) => this.toAddonOption(doc));

  }



  async listAllAddons() {

    await this.ensureAddonsSeeded();

    const items = await this.laundryAddonModel.find().sort({ sortOrder: 1, label: 1 });

    return items.map((doc) => this.serializeAddon(doc));

  }

  async getAddonById(id: string) {
    return this.laundryAddonModel.findById(id);
  }



  async updateAddon(

    id: string,

    dto: Partial<{

      label: string;

      description: string;

      category: LaundryAddonDocument['category'];

      price: number;

      imageUrl: string;

      isActive: boolean;

      sortOrder: number;

    }>,

  ) {

    const addon = await this.laundryAddonModel.findById(id);

    if (!addon) throw new NotFoundException('Add-on not found');

    if (dto.label) addon.label = dto.label.trim();

    if (dto.description != null) addon.description = dto.description.trim();

    if (dto.category != null) addon.category = dto.category;

    if (dto.price != null) addon.price = dto.price;

    if (dto.imageUrl != null) addon.imageUrl = dto.imageUrl.trim() || undefined;

    if (dto.isActive != null) addon.isActive = dto.isActive;

    if (dto.sortOrder != null) addon.sortOrder = dto.sortOrder;

    await addon.save();

    return { success: true, data: this.serializeAddon(addon) };

  }

}


