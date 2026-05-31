import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { RIDER_MIN_WITHDRAWAL, RIDER_PAYOUT_METHOD, type RiderPayoutMethod } from '@lunara/utils';

export class UpdatePayoutMethodDto {
  @IsEnum(RIDER_PAYOUT_METHOD)
  method!: RiderPayoutMethod;

  @ValidateIf((dto: UpdatePayoutMethodDto) => dto.method === RIDER_PAYOUT_METHOD.GCASH)
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'GCash number must be 11 digits starting with 09' })
  gcashNumber?: string;

  @ValidateIf((dto: UpdatePayoutMethodDto) => dto.method === RIDER_PAYOUT_METHOD.MAYA)
  @IsString()
  @Matches(/^09\d{9}$/, { message: 'Maya number must be 11 digits starting with 09' })
  mayaNumber?: string;

  @ValidateIf((dto: UpdatePayoutMethodDto) => dto.method === RIDER_PAYOUT_METHOD.BANK)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  bankName?: string;

  @ValidateIf((dto: UpdatePayoutMethodDto) => dto.method === RIDER_PAYOUT_METHOD.BANK)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  bankAccountName?: string;

  @ValidateIf((dto: UpdatePayoutMethodDto) => dto.method === RIDER_PAYOUT_METHOD.BANK)
  @IsString()
  @MinLength(4)
  @MaxLength(40)
  bankAccountNumber?: string;
}

export class RequestWithdrawalDto {
  @IsNumber()
  @Min(RIDER_MIN_WITHDRAWAL)
  amount!: number;
}

export class ReviewWithdrawalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

export class SetWalletHoldDto {
  @IsNumber()
  @Min(0)
  pendingHold!: number;
}
