import { BookingType } from '@lunara/types';
import type { Collection } from 'mongodb';
import { defaultAddonImageUrl, writeCatalogAddonImages } from './catalog-addon-images';

export const DEFAULT_LAUNDRY_SERVICES = [
  {
    type: BookingType.WASH_FOLD,
    label: 'Wash & Fold',
    description: 'Everyday clothes washed, dried, and folded',
    pricePerKg: 80,
    minWeightKg: 3,
    isActive: true,
    sortOrder: 1,
  },
  {
    type: BookingType.WASH_DRY_FOLD,
    label: 'Wash, Dry & Fold',
    description: 'Full service including machine dry',
    pricePerKg: 120,
    minWeightKg: 3,
    isActive: true,
    sortOrder: 2,
  },
  {
    type: BookingType.DRY_CLEANING,
    label: 'Dry Cleaning',
    description: 'Delicates, suits, and formal wear',
    pricePerKg: 200,
    minWeightKg: 2,
    isActive: true,
    sortOrder: 3,
  },
  {
    type: BookingType.WASH_DRY,
    label: 'Wash & Dry',
    description: 'Wash and machine dry without folding',
    pricePerKg: 100,
    minWeightKg: 3,
    isActive: false,
    sortOrder: 4,
  },
  {
    type: BookingType.WASH_DRY_FOLD_IRON,
    label: 'Wash, Dry, Fold & Iron',
    description: 'Premium pressed finish',
    pricePerKg: 160,
    minWeightKg: 3,
    isActive: false,
    sortOrder: 5,
  },
  {
    type: BookingType.COMFORTERS,
    label: 'Comforters & Bedding',
    description: 'Duvets, comforters, and heavy bedding',
    pricePerKg: 180,
    minWeightKg: 2,
    isActive: false,
    sortOrder: 6,
  },
  {
    type: BookingType.CURTAINS,
    label: 'Curtains',
    description: 'Home and office curtains',
    pricePerKg: 220,
    minWeightKg: 2,
    isActive: false,
    sortOrder: 7,
  },
  {
    type: BookingType.SHOES,
    label: 'Shoe Cleaning',
    description: 'Sneakers and casual footwear',
    pricePerKg: 250,
    minWeightKg: 1,
    isActive: false,
    sortOrder: 8,
  },
  {
    type: BookingType.UNIFORMS,
    label: 'Uniforms',
    description: 'School and work uniforms',
    pricePerKg: 90,
    minWeightKg: 3,
    isActive: false,
    sortOrder: 9,
  },
];

export const DEFAULT_LAUNDRY_ADDONS = [
  {
    slug: 'fabric_softener',
    label: 'Fabric softener',
    description: 'Extra soft finish',
    price: 25,
    isActive: true,
    sortOrder: 1,
  },
  {
    slug: 'stain_treatment',
    label: 'Stain treatment',
    description: 'Pre-treatment for tough stains',
    price: 50,
    isActive: true,
    sortOrder: 2,
  },
  {
    slug: 'eco_wash',
    label: 'Eco wash',
    description: 'Hypoallergenic detergent',
    price: 30,
    isActive: true,
    sortOrder: 3,
  },
  {
    slug: 'express_delivery',
    label: 'Express return',
    description: 'Delivery within 24h after cleaning',
    price: 80,
    isActive: true,
    sortOrder: 4,
  },
];

export async function reseedLaundryAddons(collection: Collection) {
  writeCatalogAddonImages(DEFAULT_LAUNDRY_ADDONS.map((a) => a.slug));
  const now = new Date();
  for (const addon of DEFAULT_LAUNDRY_ADDONS) {
    const imageUrl = defaultAddonImageUrl(addon.slug);
    await collection.updateOne(
      { slug: addon.slug },
      {
        $set: { ...addon, imageUrl, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    console.log(`  ${addon.slug} — ${addon.label} (${addon.isActive ? 'active' : 'inactive'})`);
  }
}

export async function reseedLaundryServices(collection: Collection) {
  const now = new Date();
  for (const service of DEFAULT_LAUNDRY_SERVICES) {
    await collection.updateOne(
      { type: service.type },
      {
        $set: { ...service, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    console.log(`  ${service.type} — ${service.label} (${service.isActive ? 'active' : 'inactive'})`);
  }
}
