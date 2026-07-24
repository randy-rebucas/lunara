import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateFavoriteBranchDto } from './dto/favorite.dto';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  findAll(@Req() req: { user: { sub: string } }) {
    return this.favoritesService.findAll(req.user.sub);
  }

  @Post()
  create(@Req() req: { user: { sub: string } }, @Body() dto: CreateFavoriteBranchDto) {
    return this.favoritesService.create(req.user.sub, dto.branchId);
  }

  @Delete(':branchId')
  remove(@Param('branchId') branchId: string, @Req() req: { user: { sub: string } }) {
    return this.favoritesService.remove(req.user.sub, branchId);
  }
}
