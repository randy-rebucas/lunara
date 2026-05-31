import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class VerifyCustomerDto {
  @ValidateIf((dto: VerifyCustomerDto) => !dto.qrPayload)
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  code?: string;

  @ValidateIf((dto: VerifyCustomerDto) => !dto.code)
  @IsString()
  @MinLength(10)
  qrPayload?: string;
}

export class CollectLaundryDto {
  @IsNumber()
  @Min(0.5)
  actualWeightKg!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CapturePhotoDto {
  @IsString()
  @MinLength(10)
  photoUrl!: string;
}

export class DropAtShopDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  qrPayload?: string;
}

export class VerifyQrDto {
  @IsString()
  @MinLength(10)
  qrPayload!: string;
}
