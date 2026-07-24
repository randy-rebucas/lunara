import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  /** Staff-only: toggled by the owning partner/admin to grant/revoke settings access. */
  @IsOptional()
  @IsBoolean()
  canManageSettings?: boolean;
}
