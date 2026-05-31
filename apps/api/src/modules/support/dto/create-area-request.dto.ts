import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAreaRequestDto {
  @IsString()
  @MinLength(1)
  addressId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
