import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Partner, PartnerDocument } from './schemas/partner.schema';

@Injectable()
export class PartnersService {
  constructor(
    @InjectModel(Partner.name) private partnerModel: Model<PartnerDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async listAll() {
    return this.partnerModel.find().sort({ createdAt: -1 });
  }

  async create(ownerUserId: string, legalName: string, slug: string) {
    const existing = await this.partnerModel.findOne({
      $or: [{ ownerUserId: new Types.ObjectId(ownerUserId) }, { slug }],
    });
    if (existing) {
      throw new BadRequestException('A partner brand already exists for this owner or slug');
    }

    const partner = await this.partnerModel.create({
      ownerUserId: new Types.ObjectId(ownerUserId),
      legalName,
      slug,
    });
    return { success: true, data: partner };
  }

  async createByOwnerEmail(ownerEmail: string, legalName: string, slug: string) {
    const owner = await this.userModel.findOne({ email: ownerEmail.trim().toLowerCase() });
    if (!owner) {
      throw new BadRequestException(`No user found with email ${ownerEmail}`);
    }
    return this.create(owner._id.toString(), legalName, slug);
  }

  async findByOwnerUserId(ownerUserId: string) {
    return this.partnerModel.findOne({ ownerUserId: new Types.ObjectId(ownerUserId) });
  }

  async findByDomain(domain: string) {
    return this.partnerModel.findOne({ 'brandConfig.domain': domain, isActive: true });
  }

  async findById(id: string) {
    const partner = await this.partnerModel.findById(id);
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }

  async updateBrandConfig(
    id: string,
    update: {
      domain?: string;
      appDisplayName?: string;
      colors?: Partial<Partner['brandConfig']['colors']>;
      fonts?: Partial<Partner['brandConfig']['fonts']>;
      status?: Partner['brandConfig']['status'];
    },
  ) {
    const partner = await this.findById(id);
    const { colors, fonts, ...rest } = update;
    Object.assign(partner.brandConfig, rest);
    if (colors) Object.assign(partner.brandConfig.colors, colors);
    if (fonts) Object.assign(partner.brandConfig.fonts, fonts);
    await partner.save();
    return { success: true, data: partner };
  }

  async setAssetUrl(id: string, field: 'logoUrl' | 'iconUrl' | 'splashUrl' | 'faviconUrl', url: string) {
    const partner = await this.findById(id);
    const previousUrl = partner.brandConfig[field];
    partner.brandConfig[field] = url;
    await partner.save();
    return { success: true, data: partner, previousUrl };
  }

  async setActive(id: string, isActive: boolean) {
    const partner = await this.findById(id);
    partner.isActive = isActive;
    await partner.save();
    return { success: true, data: partner };
  }
}
