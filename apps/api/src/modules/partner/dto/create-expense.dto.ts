import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  category!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
