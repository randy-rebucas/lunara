import { IsMongoId } from 'class-validator';

export class CreateFavoriteBranchDto {
  @IsMongoId()
  branchId!: string;
}
