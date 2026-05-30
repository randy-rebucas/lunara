import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [AuthModule],
  providers: [TrackingGateway],
  exports: [TrackingGateway],
})
export class RealtimeModule {}