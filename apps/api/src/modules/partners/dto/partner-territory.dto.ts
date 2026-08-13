import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class GeoPointDto {
  @IsNumber()
  longitude!: number;

  @IsNumber()
  latitude!: number;
}

class GeoPolygonDto {
  @IsIn(['Polygon', 'MultiPolygon'])
  type!: 'Polygon' | 'MultiPolygon';

  coordinates!: unknown;
}

export class UpsertPartnerTerritoryDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  slug!: string;

  @IsIn(['radius', 'polygon'])
  boundaryType!: 'radius' | 'polygon';

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  center?: GeoPointDto;

  @IsOptional()
  @IsNumber()
  radiusKm?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPolygonDto)
  boundary?: GeoPolygonDto;

  @IsOptional()
  @IsBoolean()
  isExclusive?: boolean;

  @IsOptional()
  @IsIn(['active', 'pending', 'suspended'])
  status?: 'active' | 'pending' | 'suspended';

  @IsOptional()
  @IsString()
  primaryContactName?: string;

  @IsOptional()
  @IsString()
  primaryContactPhone?: string;

  @IsOptional()
  @IsString()
  opsNotes?: string;
}
