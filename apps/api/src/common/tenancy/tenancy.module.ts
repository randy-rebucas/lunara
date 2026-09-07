import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Partner, PartnerSchema } from '../../modules/partners/schemas/partner.schema';
import { User, UserSchema } from '../../modules/users/schemas/user.schema';
import { Branch, BranchSchema } from '../../modules/branches/schemas/branch.schema';
import { TenantConnectionRegistry } from './tenant-connection-registry';
import { TenantGuard } from '../guards/tenant.guard';

/**
 * Global module so TenantGuard (used via @UseGuards(TenantGuard) across many feature modules)
 * and TenantConnectionRegistry can resolve their dependencies without every consuming module
 * having to re-import their Mongoose schemas. Import once in AppModule. Registers every schema
 * TenantGuard/TenantConnectionRegistry themselves inject (Partner, User, Branch) — this module's
 * own injector context resolves the guard's constructor, not the consuming module's, since the
 * guard is provided here as a global singleton.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Partner.name, schema: PartnerSchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  providers: [TenantConnectionRegistry, TenantGuard],
  exports: [TenantConnectionRegistry, TenantGuard],
})
export class TenancyModule {}
