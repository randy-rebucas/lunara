import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BookingType } from '@lunara/types';
import { areaMatchesAddress, AddressInput } from '@lunara/utils';
import { ServiceArea, ServiceAreaDocument } from './schemas/service-area.schema';

/** Coverage seeded on first run so behavior matches the platform's original hardcoded areas —
 * admins can edit/add/remove areas afterward via the admin-web Service areas page. */
const DEFAULT_AREAS: Partial<ServiceArea>[] = [
  {
    label: 'Metro Manila',
    cities: [
      'Manila',
      'Makati',
      'Quezon City',
      'Pasig',
      'Taguig',
      'Mandaluyong',
      'San Juan',
      'Marikina',
      'Parañaque',
      'Las Piñas',
      'Muntinlupa',
      'Caloocan',
      'Valenzuela',
      'Pasay',
      'Pateros',
      'Navotas',
      'Malabon',
    ],
    provinces: ['Metro Manila', 'NCR', 'National Capital Region'],
    postalPrefixes: ['10', '11', '12', '13', '14', '15', '16', '17'],
    services: [BookingType.WASH_FOLD, BookingType.WASH_DRY_FOLD, BookingType.DRY_CLEANING],
    isActive: true,
    sortOrder: 0,
  },
  {
    label: 'Baybay City, Leyte',
    cities: ['Baybay', 'Baybay City'],
    provinces: ['Leyte'],
    postalPrefixes: ['65'],
    services: [BookingType.WASH_FOLD, BookingType.WASH_DRY_FOLD, BookingType.DRY_CLEANING],
    isActive: true,
    sortOrder: 1,
  },
];

export interface ServiceAreaInput {
  label: string;
  cities: string[];
  provinces: string[];
  postalPrefixes: string[];
  services: BookingType[];
  isActive?: boolean;
  sortOrder?: number;
}

@Injectable()
export class ServiceAreasService {
  constructor(
    @InjectModel(ServiceArea.name) private serviceAreaModel: Model<ServiceAreaDocument>,
  ) {}

  async ensureSeeded() {
    const count = await this.serviceAreaModel.countDocuments();
    if (count > 0) return;
    await this.serviceAreaModel.insertMany(DEFAULT_AREAS);
  }

  async listActive() {
    await this.ensureSeeded();
    return this.serviceAreaModel
      .find({ isActive: true })
      .sort({ sortOrder: 1, label: 1 });
  }

  async listAll() {
    await this.ensureSeeded();
    return this.serviceAreaModel.find().sort({ sortOrder: 1, label: 1 });
  }

  /** Same matching semantics as the old hardcoded SERVICE_AREAS lookup — first active area whose
   * cities/provinces/postal prefixes match the address wins. */
  async resolveAreaForAddress(address: AddressInput): Promise<{
    valid: boolean;
    areaId?: string;
    areaLabel?: string;
    message?: string;
    availableServices: BookingType[];
  }> {
    const areas = await this.listActive();
    const match = areas.find((area) => areaMatchesAddress(area, address));
    if (match) {
      return {
        valid: true,
        areaId: match._id.toString(),
        areaLabel: match.label,
        availableServices: match.services,
      };
    }
    return {
      valid: false,
      message: 'Laundry pickup is not available in your area yet. Try a Metro Manila address.',
      availableServices: [],
    };
  }

  async create(input: ServiceAreaInput) {
    const created = await this.serviceAreaModel.create(input);
    return created;
  }

  async update(id: string, input: Partial<ServiceAreaInput>) {
    const area = await this.serviceAreaModel.findByIdAndUpdate(id, { $set: input }, { new: true });
    if (!area) throw new NotFoundException('Service area not found');
    return area;
  }

  async delete(id: string) {
    const result = await this.serviceAreaModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) throw new NotFoundException('Service area not found');
    return { success: true };
  }
}
