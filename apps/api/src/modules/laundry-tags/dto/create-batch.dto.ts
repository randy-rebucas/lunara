import { IsInt, IsMongoId, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateTagBatchDto {
  @IsInt()
  @Min(1)
  @Max(500)
  quantity!: number;

  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'codePrefix must be letters, numbers, and hyphens only' })
  codePrefix?: string;
}
