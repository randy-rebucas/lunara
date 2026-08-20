import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  /** Staff-only: editable by the owning partner/admin. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  /** Staff-only: editable by the owning partner/admin. */
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Staff-only: toggled by the owning partner/admin to grant/revoke settings access. */
  @IsOptional()
  @IsBoolean()
  canManageSettings?: boolean;
}
