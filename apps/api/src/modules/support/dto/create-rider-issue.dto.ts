import { IsEnum, IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum RiderIssueType {
  DAMAGED_ITEM = 'damaged_item',
  DELIVERY_DELAY = 'delivery_delay',
  OTHER = 'other',
}

export class CreateRiderIssueDto {
  @IsEnum(RiderIssueType)
  issueType!: RiderIssueType;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsMongoId()
  orderId?: string;
}
