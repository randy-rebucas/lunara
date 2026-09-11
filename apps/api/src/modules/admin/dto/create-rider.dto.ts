import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { UpdateRiderHomeAddressDto } from '../../riders/dto/rider.dto';

export class CreateRiderDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsIn(['motorcycle', 'bicycle', 'car', 'van'])
  vehicleType?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  plateNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  orCrNumber?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateRiderHomeAddressDto)
  homeAddress?: UpdateRiderHomeAddressDto;
}
