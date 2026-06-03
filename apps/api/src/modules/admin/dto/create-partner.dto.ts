import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePartnerDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
