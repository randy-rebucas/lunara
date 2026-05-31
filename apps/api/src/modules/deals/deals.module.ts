import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { DealsController } from './deals.controller';

@Module({
  imports: [AdminModule],
  controllers: [DealsController],
})
export class DealsModule {}
