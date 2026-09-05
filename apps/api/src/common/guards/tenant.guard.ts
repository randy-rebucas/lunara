import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRole } from '@lunara/types';
import { User, UserDocument } from '../../modules/users/schemas/user.schema';
import { Branch, BranchDocument } from '../../modules/branches/schemas/branch.schema';
import { TenantConnectionRegistry } from '../tenancy/tenant-connection-registry';

/**
 * Resolves and attaches the tenant (Territorial/Shop Partner) this request belongs to.
 * ADMIN is unrestricted (tenantId left undefined). PARTNER's tenant is their own user id.
 * STAFF's tenant is resolved via their assigned branch's owning partner.
 * Attaches req.tenantId / req.staffBranchId; does not itself reject the request beyond
 * failing closed when a STAFF account has no resolvable branch/partner.
 *
 * Also attaches req.tenantConnection for branded/territorial partners with a dedicated
 * database (see TenantConnectionRegistry) — undefined for everyone else, in which case
 * callers should use the app's default shared connection. Resolution failure here is
 * non-fatal: the request proceeds on the shared connection rather than erroring out.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Branch.name) private readonly branchModel: Model<BranchDocument>,
    private readonly tenantConnections: TenantConnectionRegistry,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { sub: string; role: UserRole } | undefined;
    if (!user) return true;

    if (user.role === UserRole.ADMIN) {
      req.tenantId = undefined;
      return true;
    }

    if (user.role === UserRole.PARTNER) {
      req.tenantId = user.sub;
      await this.attachTenantConnection(req, user.sub);
      return true;
    }

    if (user.role === UserRole.STAFF) {
      const staffUser = await this.userModel.findById(user.sub).select('branchId').lean();
      if (!staffUser?.branchId) {
        throw new ForbiddenException('Staff account has no branch assignment');
      }
      const branch = await this.branchModel
        .findById(staffUser.branchId)
        .select('partnerUserId')
        .lean();
      if (!branch?.partnerUserId) {
        throw new ForbiddenException('Branch has no owning partner');
      }
      req.tenantId = branch.partnerUserId.toString();
      req.staffBranchId = staffUser.branchId.toString();
      await this.attachTenantConnection(req, req.tenantId);
      return true;
    }

    return true;
  }

  private async attachTenantConnection(req: Record<string, unknown>, tenantId: string): Promise<void> {
    try {
      req.tenantConnection = await this.tenantConnections.getConnection(tenantId);
    } catch (err) {
      this.logger.warn(`Failed to resolve dedicated connection for tenant ${tenantId}: ${err}`);
      req.tenantConnection = undefined;
    }
  }
}
