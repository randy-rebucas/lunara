import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AdvanceProcessingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  verifiedWeightKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tagCode?: string;

  @IsOptional()
  @IsBoolean()
  skipIroning?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;
}

export class MoveProcessingStepDto {
  /** Validated against LaundryProcessingStepId via normalizeProcessingStepId() in the service. */
  @IsString()
  @IsNotEmpty()
  targetStepId!: string;
}
