import { IsArray, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLostItemDto {
  @IsMongoId()
  orderId!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missingItems?: string[];
}
