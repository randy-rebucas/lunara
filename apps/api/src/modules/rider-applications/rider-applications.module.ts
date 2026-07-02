import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RiderApplication, RiderApplicationSchema } from './schemas/rider-application.schema';
import { RiderApplicationsController } from './rider-applications.controller';
import { RiderApplicationsService } from './rider-applications.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: RiderApplication.name, schema: RiderApplicationSchema }]),
  ],
  controllers: [RiderApplicationsController],
  providers: [RiderApplicationsService],
  exports: [RiderApplicationsService],
})
export class RiderApplicationsModule {}
