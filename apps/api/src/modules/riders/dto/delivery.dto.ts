import { IsString, MinLength } from 'class-validator';

export class DeliveryPhotoDto {
  @IsString()
  @MinLength(10)
  photoUrl!: string;
}
