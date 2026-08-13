import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CloudinaryStorageService } from '../../common/storage/cloudinary-storage.service';
import { partnerBrandAssetUploadOptions } from './partner-brand-upload.options';
import {
  CreatePartnerDto,
  SetPartnerActiveDto,
  UpdatePartnerBrandConfigDto,
} from './dto/partner.dto';
import { UpsertPartnerTerritoryDto } from './dto/partner-territory.dto';
import { PartnersService } from './partners.service';
import { PartnerTerritoriesService } from './partner-territories.service';

const ASSET_FIELDS = ['logoUrl', 'iconUrl', 'splashUrl', 'faviconUrl'] as const;
type AssetField = (typeof ASSET_FIELDS)[number];

@Controller('admin/partners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class PartnersAdminController {
  constructor(
    private readonly partnersService: PartnersService,
    private readonly cloudinaryStorageService: CloudinaryStorageService,
    private readonly partnerTerritoriesService: PartnerTerritoriesService,
  ) {}

  @Get()
  async list() {
    const partners = await this.partnersService.listAll();
    return { success: true, data: partners };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const partner = await this.partnersService.findById(id);
    return { success: true, data: partner };
  }

  @Post()
  async create(@Body() dto: CreatePartnerDto) {
    return this.partnersService.createByOwnerEmail(dto.ownerEmail, dto.legalName, dto.slug);
  }

  @Patch(':id/branding')
  async updateBranding(@Param('id') id: string, @Body() dto: UpdatePartnerBrandConfigDto) {
    return this.partnersService.updateBrandConfig(id, dto);
  }

  @Patch(':id/active')
  async setActive(@Param('id') id: string, @Body() dto: SetPartnerActiveDto) {
    return this.partnersService.setActive(id, dto.isActive);
  }

  @Post(':id/branding/assets/:field')
  @UseInterceptors(FileInterceptor('asset', partnerBrandAssetUploadOptions))
  async uploadAsset(
    @Param('id') id: string,
    @Param('field') field: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Brand asset image is required');
    if (!ASSET_FIELDS.includes(field as AssetField)) {
      throw new BadRequestException(`Unknown brand asset field: ${field}`);
    }

    const result = await this.cloudinaryStorageService.uploadBuffer(
      file.buffer,
      'lunara/partner-brands',
      `${id}-${field}-${Date.now()}`,
      'image',
      file.mimetype,
    );
    const { previousUrl, ...response } = await this.partnersService.setAssetUrl(id, field as AssetField, result.secure_url);
    await this.cloudinaryStorageService.deleteFile('lunara/partner-brands', previousUrl);
    return response;
  }

  @Get(':id/territory')
  async getTerritory(@Param('id') id: string) {
    const territory = await this.partnerTerritoriesService.findByPartnerId(id);
    return { success: true, data: territory };
  }

  @Post(':id/territory')
  async upsertTerritory(@Param('id') id: string, @Body() dto: UpsertPartnerTerritoryDto) {
    return this.partnerTerritoriesService.upsertForPartner(id, dto);
  }

  @Patch(':id/territory')
  async patchTerritory(@Param('id') id: string, @Body() dto: UpsertPartnerTerritoryDto) {
    return this.partnerTerritoriesService.upsertForPartner(id, dto);
  }
}
