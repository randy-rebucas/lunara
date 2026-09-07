import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The resolved tenant (Territorial/Shop Partner) id for this request, set by TenantGuard. Undefined for ADMIN. */
export const CurrentTenantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string | undefined => {
  const req = ctx.switchToHttp().getRequest();
  return req.tenantId;
});

/** The requesting STAFF user's branch id, set by TenantGuard. Undefined for PARTNER/ADMIN. */
export const CurrentStaffBranchId = createParamDecorator((_: unknown, ctx: ExecutionContext): string | undefined => {
  const req = ctx.switchToHttp().getRequest();
  return req.staffBranchId;
});
