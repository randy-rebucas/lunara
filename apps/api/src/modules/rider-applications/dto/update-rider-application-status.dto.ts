import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { RiderApplicationStatus } from '../schemas/rider-application.schema';

export class UpdateRiderApplicationStatusDto {
  @IsIn(Object.values(RiderApplicationStatus))
  status!: RiderApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
}
