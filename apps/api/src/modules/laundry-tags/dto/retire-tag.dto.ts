import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RetireTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;
}
