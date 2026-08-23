import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateBlogPostDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @Matches(SLUG_PATTERN, { message: 'Slug must be lowercase letters, numbers, and hyphens only' })
  slug!: string;

  @IsString()
  @MinLength(10)
  excerpt!: string;

  @IsString()
  @MinLength(20)
  content!: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateBlogPostDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN, { message: 'Slug must be lowercase letters, numbers, and hyphens only' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
