import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class TriggerSosDto {
  @IsString()
  @MinLength(1)
  orderId!: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}
