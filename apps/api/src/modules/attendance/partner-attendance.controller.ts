import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenantId } from '../../common/decorators/current-tenant.decorator';
import { AttendanceService } from './attendance.service';
import { CorrectAttendanceDto, QueryAttendanceDto } from './dto/attendance.dto';

/** Partner-facing read/operational visibility for employee attendance — the "operations
 * overview" surface required by the feature-implementation skill's dashboard checklist.
 * PARTNER and STAFF-with-settings-access can view; scoping is enforced by TenantGuard so a
 * partner can never see another partner's employees regardless of query params. */
@Controller('partner/attendance')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles(UserRole.PARTNER)
export class PartnerAttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string | undefined, @Query() query: QueryAttendanceDto) {
    return this.attendanceService.listForPartner(tenantId!, query);
  }

  @Get('summary')
  summary(@CurrentTenantId() tenantId: string | undefined) {
    return this.attendanceService.getSummaryForPartner(tenantId!);
  }

  @Patch(':id')
  correct(
    @CurrentTenantId() tenantId: string | undefined,
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
    @Body() dto: CorrectAttendanceDto,
  ) {
    return this.attendanceService.correctRecord(tenantId!, id, req.user.sub, dto);
  }
}
