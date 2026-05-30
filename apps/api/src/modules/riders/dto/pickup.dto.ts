import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class VerifyCustomerDto {
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  code!: string;
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
