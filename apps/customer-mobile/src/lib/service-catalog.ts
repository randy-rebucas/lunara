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
  { type: BookingType.IRONING, label: 'Ironing / Press Only' },
  { type: BookingType.RUGS, label: 'Rugs & Carpets' },
  { type: BookingType.UPHOLSTERY, label: 'Upholstery' },
  { type: BookingType.BAGS, label: 'Bags' },
  { type: BookingType.LEATHER, label: 'Leather Care' },
  { type: BookingType.ALTERATION, label: 'Alteration & Repair' },
  { type: BookingType.PREMIUM_WASH_FOLD, label: 'Premium Wash & Fold' },
  { type: BookingType.BABY_CLOTHES_WASH, label: 'Baby Clothes Wash' },
  { type: BookingType.DELICATES_WASH, label: 'Delicates Wash' },
  { type: BookingType.COLOR_SEPARATION_WASH, label: 'Color Separation' },
  { type: BookingType.WHITE_GARMENTS_WASH, label: 'White Garments Only' },
  { type: BookingType.HAND_WASH, label: 'Hand Wash' },
  { type: BookingType.MACHINE_WASH, label: 'Machine Wash' },
  { type: BookingType.ECO_FRIENDLY_WASH, label: 'Eco-Friendly Wash' },
  { type: BookingType.HYPOALLERGENIC_WASH, label: 'Hypoallergenic Wash' },
  { type: BookingType.SANITIZING_DISINFECTION, label: 'Sanitizing & Disinfection' },
  { type: BookingType.WEDDING_GOWN_PRESERVATION, label: 'Wedding Gown Preservation' },
  { type: BookingType.SPECIALTY_ITEMS, label: 'Specialty Cleaning' },
];
