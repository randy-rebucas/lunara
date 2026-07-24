import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PartnerApplicationStatus } from '../schemas/partner-application.schema';

export class UpdatePartnerApplicationStatusDto {
  @IsIn(Object.values(PartnerApplicationStatus))
  status!: PartnerApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
}
