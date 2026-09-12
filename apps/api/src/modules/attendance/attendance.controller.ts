import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';
import { ClockInDto, ClockOutDto, CreateCorrectionRequestDto } from './dto/attendance.dto';

/** Self-service clock-in/out for the employee performing the action — STAFF (laundry
 * attendants) and RIDER. Partner-facing read endpoints live in PartnerAttendanceController. */
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.RIDER)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('clock-in')
  clockIn(@Req() req: { user: { sub: string } }, @Body() dto: ClockInDto) {
    return this.attendanceService.clockIn(req.user.sub, dto);
  }

  @Post('clock-out')
  clockOut(@Req() req: { user: { sub: string } }, @Body() dto: ClockOutDto) {
    return this.attendanceService.clockOut(req.user.sub, dto);
  }

  @Get('me/current')
  getCurrent(@Req() req: { user: { sub: string } }) {
    return this.attendanceService.getCurrent(req.user.sub);
  }

  @Get('me/history')
  getMyHistory(@Req() req: { user: { sub: string } }, @Query('limit') limit?: string) {
    return this.attendanceService.getMyHistory(req.user.sub, limit ? Number(limit) : undefined);
  }

  @Get('me/target')
  getMyTarget(@Req() req: { user: { sub: string } }) {
    return this.attendanceService.getMyTarget(req.user.sub);
  }

  @Post('me/correction-requests')
  requestCorrection(@Req() req: { user: { sub: string } }, @Body() dto: CreateCorrectionRequestDto) {
    return this.attendanceService.requestCorrection(req.user.sub, dto);
  }

  @Get('me/correction-requests')
  getMyCorrectionRequests(@Req() req: { user: { sub: string } }) {
    return this.attendanceService.listMyCorrectionRequests(req.user.sub);
  }
}
