import { IsString, MinLength } from 'class-validator';

export class AttachPaymentMethodDto {
  @IsString()
  @MinLength(5)
  paymongoPaymentMethodId!: string;
}
