import { IsMongoId } from 'class-validator';

export class AssignRiderDto {
  @IsMongoId()
  riderUserId!: string;
}
