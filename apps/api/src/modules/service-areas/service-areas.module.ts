import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceAreasService } from './service-areas.service';
import { ServiceArea, ServiceAreaSchema } from './schemas/service-area.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: ServiceArea.name, schema: ServiceAreaSchema }])],
  providers: [ServiceAreasService],
  exports: [ServiceAreasService],
})
export class ServiceAreasModule {}
