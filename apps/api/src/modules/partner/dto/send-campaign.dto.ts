import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(65)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  body!: string;
}
