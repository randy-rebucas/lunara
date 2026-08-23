import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BlogService } from './blog.service';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/blog-post.dto';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const coverImageUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, accept: boolean) => void) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new BadRequestException('Only JPEG, PNG, or WebP images are allowed'), false);
      return;
    }
    cb(null, true);
  },
};

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  /** Public feed — no auth required, published posts only. */
  @Get()
  listPublished() {
    return this.blogService.listPublished();
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.blogService.getPublishedBySlug(slug);
  }
}

@Controller('admin/blog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminBlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  list() {
    return this.blogService.adminList();
  }

  @Post()
  @UseInterceptors(FileInterceptor('coverImage', coverImageUploadOptions))
  create(
    @Body() dto: CreateBlogPostDto,
    @Req() req: { user: { email?: string } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.blogService.create(dto, req.user.email ?? 'Admin', file);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.blogService.update(id, dto);
  }

  @Post(':id/cover-image')
  @UseInterceptors(FileInterceptor('coverImage', coverImageUploadOptions))
  updateCoverImage(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.blogService.updateCoverImage(id, file);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.blogService.remove(id);
  }
}
