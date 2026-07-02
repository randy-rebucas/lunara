import { IsIn } from 'class-validator';
import { RiderApplicationStatus } from '../schemas/rider-application.schema';

export class UpdateRiderApplicationStatusDto {
  @IsIn(Object.values(RiderApplicationStatus))
  status!: RiderApplicationStatus;
}
