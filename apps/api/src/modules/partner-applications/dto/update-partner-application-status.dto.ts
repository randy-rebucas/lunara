import { IsIn } from 'class-validator';
import { PartnerApplicationStatus } from '../schemas/partner-application.schema';

export class UpdatePartnerApplicationStatusDto {
  @IsIn(Object.values(PartnerApplicationStatus))
  status!: PartnerApplicationStatus;
}
