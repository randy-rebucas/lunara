import { IsArray, IsNotEmpty, IsNumber, IsString, MinLength } from 'class-validator';

export class InitNetworkDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsNotEmpty()
  line1!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsArray()
  @IsNumber({}, { each: true })
  coordinates!: [number, number];
}
