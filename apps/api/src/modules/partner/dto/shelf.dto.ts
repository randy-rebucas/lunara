import { IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreateShelfDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  /** Only meaningful for a PARTNER managing more than one branch; ignored for STAFF (their own branch is used). */
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class AddShelfItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
