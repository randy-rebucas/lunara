import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LaundryTag, LaundryTagSchema } from './schemas/laundry-tag.schema';
import { LaundryTagsController } from './laundry-tags.controller';
import { LaundryTagsService } from './laundry-tags.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: LaundryTag.name, schema: LaundryTagSchema }])],
  controllers: [LaundryTagsController],
  providers: [LaundryTagsService],
  exports: [LaundryTagsService],
})
export class LaundryTagsModule {}
