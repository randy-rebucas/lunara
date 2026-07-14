import { IsString } from 'class-validator';

export class AssignStaffBranchDto {
  @IsString()
  branchId!: string;
}
