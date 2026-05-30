import { IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class AdminAssignRiderDto {
  @IsOptional()
  @IsMongoId()
  riderId?: string;

  @IsOptional()
  @IsString()
  type?: 'pickup' | 'delivery';
}

export class ResolveConflictDto {
  @IsString()
  @MinLength(3)
  resolution!: string;
}
