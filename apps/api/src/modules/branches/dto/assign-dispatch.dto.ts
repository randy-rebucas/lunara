import { IsMongoId } from 'class-validator';

export class AssignDispatchDto {
  @IsMongoId()
  branchId!: string;
}
