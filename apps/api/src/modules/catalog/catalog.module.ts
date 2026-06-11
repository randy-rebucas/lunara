import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogService } from './catalog.service';
import { LaundryAddon, LaundryAddonSchema } from './schemas/laundry-addon.schema';
import { LaundryService, LaundryServiceSchema } from './schemas/laundry-service.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LaundryService.name, schema: LaundryServiceSchema },
      { name: LaundryAddon.name, schema: LaundryAddonSchema },
    ]),
  ],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
