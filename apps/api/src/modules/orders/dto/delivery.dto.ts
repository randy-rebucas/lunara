import { IsString, MaxLength, MinLength } from 'class-validator';

export class CustomerVerifyDeliveryDto {
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  code!: string;
}

export class CustomerSignDeliveryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  signatureName!: string;
}
