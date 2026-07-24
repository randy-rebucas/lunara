import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { FavoriteBranch, FavoriteBranchSchema } from './schemas/favorite-branch.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FavoriteBranch.name, schema: FavoriteBranchSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
