import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { distanceKm } from '@lunara/utils';
import {
  PartnerTerritory,
  PartnerTerritoryDocument,
} from './schemas/partner-territory.schema';
import { UpsertPartnerTerritoryDto } from './dto/partner-territory.dto';
import { PartnersService } from './partners.service';

const isPointInPolygon = (point: [number, number], polygon: [number, number][]): boolean => {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

@Injectable()
export class PartnerTerritoriesService {
  constructor(
    @InjectModel(PartnerTerritory.name)
    private territoryModel: Model<PartnerTerritoryDocument>,
    private partnersService: PartnersService,
  ) {}

  async findByPartnerId(partnerId: string) {
    return this.territoryModel.findOne({ partnerId: new Types.ObjectId(partnerId) });
  }

  /** Branches/bookings key partners by `Partner.ownerUserId` (the User._id), not `Partner._id` —
   * this resolves that indirection for dispatch-time territory lookups. */
  async findByOwnerUserId(ownerUserId: Types.ObjectId) {
    const partner = await this.partnersService.findByOwnerUserId(ownerUserId.toString());
    if (!partner) return null;
    return this.findByPartnerId(partner._id.toString());
  }

  async upsertForPartner(partnerId: string, dto: UpsertPartnerTerritoryDto) {
    if (dto.boundaryType === 'radius' && (!dto.center || dto.radiusKm == null)) {
      throw new BadRequestException('center and radiusKm are required for a radius territory');
    }
    if (dto.boundaryType === 'polygon' && !dto.boundary) {
      throw new BadRequestException('boundary is required for a polygon territory');
    }

    const update: Partial<PartnerTerritory> = {
      name: dto.name,
      slug: dto.slug,
      boundaryType: dto.boundaryType,
      isExclusive: dto.isExclusive ?? true,
      status: dto.status ?? 'active',
      primaryContactName: dto.primaryContactName,
      primaryContactPhone: dto.primaryContactPhone,
      opsNotes: dto.opsNotes,
    };
    if (dto.center) {
      update.center = { type: 'Point', coordinates: [dto.center.longitude, dto.center.latitude] };
    }
    if (dto.radiusKm != null) update.radiusKm = dto.radiusKm;
    if (dto.boundary) update.boundary = dto.boundary;

    try {
      const territory = await this.territoryModel.findOneAndUpdate(
        { partnerId: new Types.ObjectId(partnerId) },
        { $set: update, $setOnInsert: { partnerId: new Types.ObjectId(partnerId) } },
        { new: true, upsert: true },
      );
      return { success: true, data: territory };
    } catch (e) {
      if ((e as { code?: number })?.code === 11000) {
        throw new BadRequestException('That territory slug is already in use');
      }
      throw e;
    }
  }

  async getForPartnerOrThrow(partnerId: string) {
    const territory = await this.findByPartnerId(partnerId);
    if (!territory) throw new NotFoundException('No territory configured for this partner');
    return territory;
  }

  /** True when the address falls inside the territory's boundary. A territory with no
   * boundary configured yet imposes no restriction (fail open, matches pre-Territory behavior). */
  isAddressInTerritory(
    territory: Pick<PartnerTerritory, 'boundaryType' | 'center' | 'radiusKm' | 'boundary'>,
    coordinates: [number, number],
  ): boolean {
    if (territory.boundaryType === 'radius') {
      if (!territory.center || territory.radiusKm == null) return true;
      const dist = distanceKm(coordinates, territory.center.coordinates);
      return dist <= territory.radiusKm;
    }
    if (territory.boundaryType === 'polygon') {
      if (!territory.boundary) return true;
      const rings =
        territory.boundary.type === 'Polygon'
          ? [territory.boundary.coordinates as [number, number][][]]
          : (territory.boundary.coordinates as [number, number][][][]);
      return rings.some((polygon) => isPointInPolygon(coordinates, polygon[0]));
    }
    return true;
  }

  /** Every active, exclusive territory whose boundary contains the given coordinates. Used to
   * keep the shared admin dispatch queue from routing an address into another partner's turf. */
  async findExclusiveTerritoriesContaining(coordinates: [number, number]) {
    const territories = await this.territoryModel.find({ status: 'active', isExclusive: true });
    return territories.filter((t) => this.isAddressInTerritory(t, coordinates));
  }

  /** Owner-User ids (Branch.partnerUserId's referent) whose partner holds an exclusive territory
   * containing the given coordinates — Branch keys partners by ownerUserId, not Partner._id, so
   * dispatch-time branch filtering needs this indirection resolved. */
  async findExclusiveOwnerUserIdsContaining(coordinates: [number, number]): Promise<Set<string>> {
    const territories = await this.findExclusiveTerritoriesContaining(coordinates);
    if (territories.length === 0) return new Set();
    const partners = await Promise.all(
      territories.map((t) => this.partnersService.findById(t.partnerId.toString()).catch(() => null)),
    );
    return new Set(partners.filter((p): p is NonNullable<typeof p> => !!p).map((p) => p.ownerUserId.toString()));
  }
}
