import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PartnersService } from '../partners/partners.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

/** No auth — consumed by the public marketing site (homepage testimonials). Pass `domain` for a
 * white-label partner's custom domain to scope reviews to that partner only; omitted/unresolved
 * domain falls back to the platform-wide directory (default lunara.com marketing site). */
@Controller('public/reviews')
export class PublicReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly partnersService: PartnersService,
  ) {}

  @Get('featured')
  async listFeatured(@Query('limit') limit = '12', @Query('domain') domain?: string) {
    const partner = domain?.trim() ? await this.partnersService.findByDomain(domain.trim()) : null;
    return this.reviewsService.listFeatured(Number(limit), partner?.ownerUserId.toString());
  }
}

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

  @Patch('notifications/read-all')
  @Roles(UserRole.CUSTOMER)
  markAllRead(@Req() req: { user: { sub: string } }) {
    return this.reviewsService.markAllNotificationsRead(req.user.sub);
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
