import { IsNotEmpty, IsString } from 'class-validator';

export class AssignTagDto {
  @IsString()
  @IsNotEmpty()
  scannedValue!: string;
}
