import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
