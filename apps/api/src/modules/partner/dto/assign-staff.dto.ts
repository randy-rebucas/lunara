import { IsString } from 'class-validator';

export class AssignStaffDto {
  @IsString()
  staffId!: string;
}
