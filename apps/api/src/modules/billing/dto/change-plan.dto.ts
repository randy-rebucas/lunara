import { IsMongoId } from 'class-validator';

export class ChangePlanDto {
  @IsMongoId()
  planId!: string;
}
