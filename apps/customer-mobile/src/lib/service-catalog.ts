import { BookingType } from '@lunara/types';

export interface ServiceCatalogItem {
  type: BookingType;
  label: string;
}

/** Full service list per product spec; booking config may offer a subset in-area. */
export const RECOMMENDED_SERVICES: ServiceCatalogItem[] = [
  { type: BookingType.WASH_FOLD, label: 'Wash & Fold' },
  { type: BookingType.WASH_DRY, label: 'Wash & Dry' },
  { type: BookingType.WASH_DRY_FOLD, label: 'Wash, Dry & Fold' },
  { type: BookingType.WASH_DRY_FOLD_IRON, label: 'Wash, Dry, Fold & Iron' },
  { type: BookingType.DRY_CLEANING, label: 'Dry Cleaning' },
  { type: BookingType.COMFORTERS, label: 'Comforters' },
  { type: BookingType.CURTAINS, label: 'Curtains' },
  { type: BookingType.SHOES, label: 'Shoes' },
  { type: BookingType.UNIFORMS, label: 'Uniforms' },
];
