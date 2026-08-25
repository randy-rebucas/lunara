import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CloudinaryStorageService } from '../../common/storage/cloudinary-storage.service';
import { userPhotoUploadOptions } from './user-photo-upload.options';
import { UsersService, UserImportRow } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryStorageService: CloudinaryStorageService,
  ) {}

  @Get('me')
  getProfile(@Req() req: { user: { sub: string } }) {
    return this.usersService.getProfile(req.user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query('department') department?: string) {
    return this.usersService.findAll(department);
  }

  @Patch(':id/active')
  @Roles(UserRole.ADMIN)
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.usersService.setActive(id, isActive);
  }

  @Patch('bulk-active')
  @Roles(UserRole.ADMIN)
  bulkSetActive(@Body('ids') ids: string[], @Body('isActive') isActive: boolean) {
    return this.usersService.bulkSetActive(ids ?? [], isActive);
  }

  @Patch(':id/department')
  @Roles(UserRole.ADMIN)
  setDepartment(@Param('id') id: string, @Body('department') department: string) {
    return this.usersService.setDepartment(id, department ?? '');
  }

  @Post(':id/photo')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('photo', userPhotoUploadOptions))
  async uploadPhoto(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Photo image is required');
    const result = await this.cloudinaryStorageService.uploadBuffer(
      file.buffer,
      'lunara/user-photos',
      `${id}-${Date.now()}`,
      'image',
      file.mimetype,
    );
    const { previousUrl, ...response } = await this.usersService.setPhoto(id, result.secure_url);
    await this.cloudinaryStorageService.deleteFile('lunara/user-photos', previousUrl);
    return response;
  }

  @Post('import')
  @Roles(UserRole.ADMIN)
  bulkImport(@Body('rows') rows: UserImportRow[]) {
    return this.usersService.bulkImport(rows ?? []);
  }

  @Post('cleanup-spam')
  @Roles(UserRole.ADMIN)
  cleanupSpam() {
    return this.usersService.cleanupSpamUsers();
  }
}
