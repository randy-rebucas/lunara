import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const BRANCH_MACHINE_TYPES = ['washer', 'dryer', 'folder', 'press', 'other'] as const;
export const BRANCH_MACHINE_STATUSES = ['active', 'maintenance', 'offline'] as const;

export type BranchMachineType = (typeof BRANCH_MACHINE_TYPES)[number];
export type BranchMachineStatus = (typeof BRANCH_MACHINE_STATUSES)[number];

export class CreateBranchMachineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @IsIn(BRANCH_MACHINE_TYPES)
  machineType!: BranchMachineType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  capacityKg?: number;

  @IsOptional()
  @IsIn(BRANCH_MACHINE_STATUSES)
  status?: BranchMachineStatus;
}

export class UpdateBranchMachineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsIn(BRANCH_MACHINE_TYPES)
  machineType?: BranchMachineType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  capacityKg?: number;

  @IsOptional()
  @IsIn(BRANCH_MACHINE_STATUSES)
  status?: BranchMachineStatus;
}
