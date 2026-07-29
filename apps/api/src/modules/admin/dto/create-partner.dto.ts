import { IsEmail, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

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

  /** Links the created User back to the PartnerApplication it was onboarded from. */
  @IsOptional()
  @IsMongoId()
  sourceApplicationId?: string;
}
