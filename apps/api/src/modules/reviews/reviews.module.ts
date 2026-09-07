import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { PartnersModule } from '../partners/partners.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PublicReviewsController, ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { Review, ReviewSchema } from './schemas/review.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    RealtimeModule,
    PartnersModule,
  ],
  controllers: [ReviewsController, PublicReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
