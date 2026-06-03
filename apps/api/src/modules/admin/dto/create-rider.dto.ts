import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
