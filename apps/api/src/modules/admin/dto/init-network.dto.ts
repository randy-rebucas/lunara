import { IsArray, IsNumber, IsString, MinLength } from 'class-validator';

export class InitNetworkDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  line1!: string;

  @IsString()
  city!: string;

  @IsString()
  province!: string;

  @IsArray()
  @IsNumber({}, { each: true })
  coordinates!: [number, number];
}
