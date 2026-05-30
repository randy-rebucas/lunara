import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('notifications/me')
  @Roles(UserRole.CUSTOMER)
  listNotifications(
    @Req() req: { user: { sub: string } },
    @Query('limit') limit = '20',
  ) {
    return this.reviewsService.listNotifications(req.user.sub, Number(limit));
  }

  @Patch('notifications/:id/read')
  @Roles(UserRole.CUSTOMER)
  markRead(@Req() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.reviewsService.markNotificationRead(req.user.sub, id);
  }

  @Get('reviews/orders/:orderId')
  @Roles(UserRole.CUSTOMER)
  getOrderReviewStatus(
    @Req() req: { user: { sub: string } },
    @Param('orderId') orderId: string,
  ) {
    return this.reviewsService.getOrderReviewStatus(orderId, req.user.sub);
  }

  @Post('reviews')
  @Roles(UserRole.CUSTOMER)
  submitReview(@Req() req: { user: { sub: string } }, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(req.user.sub, dto);
  }
}
