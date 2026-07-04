import { IsMongoId, IsOptional } from 'class-validator';

export class UpdateBranchAssignedRiderDto {
  /** Rider userId to set as this branch's default rider, or omit/null to clear it. */
  @IsOptional()
  @IsMongoId()
  riderId?: string | null;
}
