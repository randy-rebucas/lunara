import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LaundryTagsService } from './laundry-tags.service';
import { CreateTagBatchDto } from './dto/create-batch.dto';
import { RetireTagDto } from './dto/retire-tag.dto';
import { QueryTagsDto } from './dto/query-tags.dto';

@Controller('laundry-tags')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LaundryTagsController {
  constructor(private readonly laundryTagsService: LaundryTagsService) {}

  @Post('batches')
  @Roles(UserRole.ADMIN)
  async generateBatch(@Req() req: { user: { sub: string } }, @Body() dto: CreateTagBatchDto) {
    const data = await this.laundryTagsService.generateBatch(dto, req.user.sub);
    return { success: true, data };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PARTNER, UserRole.STAFF)
  async listTags(
    @Query() query: QueryTagsDto,
    @Req() req: { user: { sub: string; role: UserRole.ADMIN | UserRole.PARTNER | UserRole.STAFF } },
  ) {
    const data = await this.laundryTagsService.listTags(query, req.user);
    return { success: true, data };
  }

  @Get('lookup')
  @Roles(UserRole.ADMIN, UserRole.PARTNER, UserRole.STAFF, UserRole.RIDER, UserRole.CUSTOMER)
  async lookup(
    @Query('code') code: string,
    @Req() req: { user: { sub: string; role: UserRole } },
  ) {
    if (!code?.trim()) throw new BadRequestException('code is required');
    const data = await this.laundryTagsService.lookup(code, req.user);
    return { success: true, data };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  async getById(@Param('id') id: string) {
    const data = await this.laundryTagsService.getById(id);
    return { success: true, data };
  }

  @Post(':id/retire')
  @Roles(UserRole.ADMIN)
  async retire(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: RetireTagDto,
  ) {
    const data = await this.laundryTagsService.retire(id, dto, req.user.sub);
    return { success: true, data };
  }

  @Post(':id/reactivate')
  @Roles(UserRole.ADMIN)
  async reactivate(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    const data = await this.laundryTagsService.reactivate(id, req.user.sub);
    return { success: true, data };
  }
}
