import { IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsMongoId()
  conversationId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message!: string;
}
