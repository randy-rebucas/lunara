import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { LaundryTag, LaundryTagSchema } from './schemas/laundry-tag.schema';
import { LaundryTagsController } from './laundry-tags.controller';
import { LaundryTagsService } from './laundry-tags.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LaundryTag.name, schema: LaundryTagSchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [LaundryTagsController],
  providers: [LaundryTagsService],
  exports: [LaundryTagsService],
})
export class LaundryTagsModule {}
