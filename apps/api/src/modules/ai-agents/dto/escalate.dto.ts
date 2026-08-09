import { IsEmail, IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class EscalateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsMongoId()
  conversationId?: string;

  /** Client-supplied recent chat history, for context — best-effort, not authoritative. */
  @IsOptional()
  @IsString()
  @MaxLength(6000)
  transcript?: string;
}

export class GuestEscalateDto extends EscalateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsEmail()
  email!: string;
}
