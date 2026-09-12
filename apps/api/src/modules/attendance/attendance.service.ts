import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '@lunara/types';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Branch, BranchDocument, DEFAULT_PARTNER_PORTAL_SETTINGS } from '../branches/schemas/branch.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { NotificationDispatchService } from '../push/notification-dispatch.service';
import { AttendanceRecord, AttendanceRecordDocument } from './schemas/attendance-record.schema';
import {
  AttendanceCorrectionRequest,
  AttendanceCorrectionRequestDocument,
} from './schemas/attendance-correction-request.schema';
import {
  ClockInDto,
  ClockOutDto,
  CorrectAttendanceDto,
  CreateCorrectionRequestDto,
  QueryAttendanceDto,
  ReviewCorrectionRequestDto,
} from './dto/attendance.dto';
import { assertValidCorrection, computeSessionHours, InvalidAttendanceCorrectionError, workDateFor } from './attendance-logic';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(AttendanceRecord.name) private attendanceModel: Model<AttendanceRecordDocument>,
    @InjectModel(AttendanceCorrectionRequest.name)
    private correctionRequestModel: Model<AttendanceCorrectionRequestDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    private trackingGateway: TrackingGateway,
    private notificationDispatch: NotificationDispatchService,
  ) {}

  /** Best-effort live push to the partner portal's Attendance tab — a failed/absent socket
   * connection must never break the underlying clock-in/out/correction mutation. */
  private notifyPartner(partnerId: Types.ObjectId, event: Record<string, unknown>) {
    try {
      this.trackingGateway.emitAttendanceUpdate(partnerId.toString(), event);
    } catch {
      // Realtime is a convenience layer; the dashboard still refetches on its own cadence.
    }
  }

  /** Resolves the employee's owning partner + role-specific scoping fields. Single source of
   * truth for "who does this employee work for" so clock-in can't be spoofed via request body. */
  private async resolveEmployeeScope(
    userId: string,
  ): Promise<{ role: UserRole.STAFF | UserRole.RIDER; partnerId: Types.ObjectId; branchId?: Types.ObjectId }> {
    const user = await this.userModel.findById(userId).select('role branchId').lean();
    if (!user) throw new NotFoundException('User not found');

    if (user.role === UserRole.STAFF) {
      if (!user.branchId) throw new ForbiddenException('Staff account has no branch assignment');
      const branch = await this.branchModel.findById(user.branchId).select('partnerUserId').lean();
      if (!branch?.partnerUserId) throw new ForbiddenException('Branch has no owning partner');
      return { role: UserRole.STAFF, partnerId: branch.partnerUserId, branchId: user.branchId };
    }

    if (user.role === UserRole.RIDER) {
      const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(userId) }).select('partnerId').lean();
      if (!rider?.partnerId) throw new ForbiddenException('Rider has no owning partner');
      return { role: UserRole.RIDER, partnerId: rider.partnerId };
    }

    throw new ForbiddenException('Only staff and riders can clock in/out');
  }

  async clockIn(userId: string, dto: ClockInDto) {
    const scope = await this.resolveEmployeeScope(userId);

    const existingActive = await this.attendanceModel.findOne({
      userId: new Types.ObjectId(userId),
      status: 'active',
    });
    if (existingActive) {
      throw new ConflictException('Already clocked in');
    }

    const now = new Date();
    try {
      const record = await this.attendanceModel.create({
        userId: new Types.ObjectId(userId),
        partnerId: scope.partnerId,
        role: scope.role,
        branchId: scope.branchId,
        workDate: workDateFor(now),
        clockInAt: now,
        status: 'active',
        clockInLocation: dto.location,
        source: 'mobile',
      });
      const view = this.toRecordView(record);
      this.notifyPartner(scope.partnerId, { type: 'clock_in', record: view });
      return { success: true, data: view };
    } catch (err: unknown) {
      // Race: two concurrent clock-ins hit the partial-unique index at once.
      if (this.isDuplicateKeyError(err)) {
        throw new ConflictException('Already clocked in');
      }
      throw err;
    }
  }

  async clockOut(userId: string, dto: ClockOutDto) {
    const record = await this.attendanceModel.findOne({
      userId: new Types.ObjectId(userId),
      status: 'active',
    });
    if (!record) {
      throw new ConflictException('Not currently clocked in');
    }

    record.clockOutAt = new Date();
    record.status = 'completed';
    if (dto.location) record.clockOutLocation = dto.location;
    if (dto.notes) record.notes = dto.notes;
    await record.save();

    const view = this.toRecordView(record);
    this.notifyPartner(record.partnerId, { type: 'clock_out', record: view });
    return { success: true, data: view };
  }

  async getCurrent(userId: string) {
    const record = await this.attendanceModel.findOne({
      userId: new Types.ObjectId(userId),
      status: 'active',
    });
    return { success: true, data: record ? this.toRecordView(record) : null };
  }

  /** Expected daily hours for this employee, resolved from their owning shop's settings — the
   * "who can set the target" answer: only a partner owner/admin, via portalSettings. */
  async getMyTarget(userId: string) {
    const scope = await this.resolveEmployeeScope(userId);
    const dailyTargetHours = await this.resolveTargetHours(scope.partnerId, scope.branchId);
    return { success: true, data: { dailyTargetHours } };
  }

  private async resolveTargetHours(partnerId: Types.ObjectId, branchId?: Types.ObjectId): Promise<number> {
    const branch = branchId
      ? await this.branchModel.findById(branchId).select('portalSettings').lean()
      : await this.branchModel
          .findOne({ partnerUserId: partnerId })
          .sort({ isMainShop: -1, name: 1 })
          .select('portalSettings')
          .lean();
    return (
      branch?.portalSettings?.dailyAttendanceTargetHours ?? DEFAULT_PARTNER_PORTAL_SETTINGS.dailyAttendanceTargetHours
    );
  }

  async getMyHistory(userId: string, limit = 30) {
    const records = await this.attendanceModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ clockInAt: -1 })
      .limit(Math.min(limit, 100));
    return { success: true, data: records.map((r) => this.toRecordView(r)) };
  }

  /** Partner-scoped list for the dashboard. `tenantId` comes from TenantGuard — never trust a
   * client-supplied partner id, or one partner could read another's attendance by editing a URL. */
  async listForPartner(tenantId: string, query: QueryAttendanceDto) {
    const filter: Record<string, unknown> = { partnerId: new Types.ObjectId(tenantId) };
    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      const range: Record<string, string> = {};
      if (query.from) range.$gte = query.from;
      if (query.to) range.$lte = query.to;
      filter.workDate = range;
    }

    const limit = Math.min(Number(query.limit) || 50, 200);
    const records = await this.attendanceModel
      .find(filter)
      .sort({ clockInAt: -1 })
      .limit(limit);

    const userIds = [...new Set(records.map((r) => r.userId.toString()))];
    const users = await this.userModel
      .find({ _id: { $in: userIds } })
      .select('email phone role')
      .lean();
    const userById = new Map(users.map((u) => [u._id.toString(), u]));

    const data = records.map((r) => {
      const u = userById.get(r.userId.toString());
      return {
        ...this.toRecordView(r),
        employeeEmail: u?.email,
        employeePhone: u?.phone,
      };
    });

    return { success: true, data };
  }

  /** Today's staffing snapshot for the partner dashboard — active count + total hours today,
   * broken down by role, computed server-side per the skill's "don't reconstruct in the browser" rule. */
  async getSummaryForPartner(tenantId: string) {
    const partnerId = new Types.ObjectId(tenantId);
    const today = workDateFor(new Date());

    const [activeStaff, activeRiders, todayRecords] = await Promise.all([
      this.attendanceModel.countDocuments({ partnerId, role: UserRole.STAFF, status: 'active' }),
      this.attendanceModel.countDocuments({ partnerId, role: UserRole.RIDER, status: 'active' }),
      this.attendanceModel.find({ partnerId, workDate: today }).lean(),
    ]);

    let totalStaffHoursToday = 0;
    let totalRiderHoursToday = 0;
    for (const r of todayRecords) {
      const hours = computeSessionHours(new Date(r.clockInAt), r.clockOutAt ? new Date(r.clockOutAt) : undefined);
      if (r.role === UserRole.STAFF) totalStaffHoursToday += hours;
      else totalRiderHoursToday += hours;
    }

    return {
      success: true,
      data: {
        workDate: today,
        activeStaff,
        activeRiders,
        totalEmployeesToday: new Set(todayRecords.map((r) => r.userId.toString())).size,
        totalStaffHoursToday: Math.round(totalStaffHoursToday * 10) / 10,
        totalRiderHoursToday: Math.round(totalRiderHoursToday * 10) / 10,
      },
    };
  }

  /** Partner owner/admin correction of an employee's record — e.g. they forgot to clock out.
   * Scoped to the partner's own tenant and always audited (correctedBy/correctedAt), per the
   * skill's requirement that attendance edits be tracked, not silent. */
  async correctRecord(tenantId: string, recordId: string, correctorUserId: string, dto: CorrectAttendanceDto) {
    const record = await this.attendanceModel.findOne({
      _id: recordId,
      partnerId: new Types.ObjectId(tenantId),
    });
    if (!record) throw new NotFoundException('Attendance record not found');

    const nextClockInAt = dto.clockInAt ? new Date(dto.clockInAt) : record.clockInAt;
    const nextClockOutAt =
      dto.clockOutAt !== undefined
        ? dto.clockOutAt === null
          ? undefined
          : new Date(dto.clockOutAt)
        : record.clockOutAt;

    try {
      assertValidCorrection(nextClockInAt, nextClockOutAt);
    } catch (err) {
      if (err instanceof InvalidAttendanceCorrectionError) throw new BadRequestException(err.message);
      throw err;
    }

    const reopening = !nextClockOutAt && record.status === 'completed';
    if (reopening) {
      const otherActive = await this.attendanceModel.exists({
        userId: record.userId,
        status: 'active',
        _id: { $ne: record._id },
      });
      if (otherActive) {
        throw new ConflictException('This employee already has another active session');
      }
    }

    record.clockInAt = nextClockInAt;
    record.clockOutAt = nextClockOutAt;
    record.status = nextClockOutAt ? 'completed' : 'active';
    if (dto.notes !== undefined) record.notes = dto.notes;
    record.source = 'partner_correction';
    record.correctedBy = new Types.ObjectId(correctorUserId);
    record.correctedAt = new Date();
    await record.save();

    const view = this.toRecordView(record);
    this.notifyPartner(record.partnerId, { type: 'correction', record: view });
    return { success: true, data: view };
  }

  /** Rider/staff self-service: request an amendment to one of their own sessions (e.g. forgot to
   * clock out). Nothing on the record changes yet — a partner owner/admin must approve it via
   * reviewCorrectionRequest, which is what actually calls correctRecord. */
  async requestCorrection(userId: string, dto: CreateCorrectionRequestDto) {
    const record = await this.attendanceModel.findOne({
      _id: dto.recordId,
      userId: new Types.ObjectId(userId),
    });
    if (!record) throw new NotFoundException('Attendance record not found');

    if (!dto.requestedClockInAt && !dto.requestedClockOutAt) {
      throw new BadRequestException('Provide a requested clock-in or clock-out time');
    }

    const existingPending = await this.correctionRequestModel.exists({
      recordId: record._id,
      status: 'pending',
    });
    if (existingPending) {
      throw new ConflictException('This shift already has a pending adjustment request');
    }

    const requestedClockInAt = dto.requestedClockInAt ? new Date(dto.requestedClockInAt) : undefined;
    const requestedClockOutAt = dto.requestedClockOutAt ? new Date(dto.requestedClockOutAt) : undefined;

    try {
      assertValidCorrection(requestedClockInAt ?? record.clockInAt, requestedClockOutAt ?? record.clockOutAt);
    } catch (err) {
      if (err instanceof InvalidAttendanceCorrectionError) throw new BadRequestException(err.message);
      throw err;
    }

    const request = await this.correctionRequestModel.create({
      recordId: record._id,
      userId: record.userId,
      partnerId: record.partnerId,
      role: record.role,
      workDate: record.workDate,
      originalClockInAt: record.clockInAt,
      originalClockOutAt: record.clockOutAt,
      requestedClockInAt,
      requestedClockOutAt,
      reason: dto.reason,
      status: 'pending',
    });

    const view = this.toCorrectionRequestView(request);
    this.notifyPartner(record.partnerId, { type: 'correction_request', request: view });
    return { success: true, data: view };
  }

  async listMyCorrectionRequests(userId: string) {
    const requests = await this.correctionRequestModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50);
    return { success: true, data: requests.map((r) => this.toCorrectionRequestView(r)) };
  }

  /** Partner-scoped review queue. Same tenant-isolation rule as listForPartner — `tenantId` must
   * come from TenantGuard, never a client-supplied id. */
  async listCorrectionRequestsForPartner(tenantId: string, status?: 'pending' | 'approved' | 'rejected') {
    const filter: Record<string, unknown> = { partnerId: new Types.ObjectId(tenantId) };
    if (status) filter.status = status;

    const requests = await this.correctionRequestModel.find(filter).sort({ createdAt: -1 }).limit(200);
    const userIds = [...new Set(requests.map((r) => r.userId.toString()))];
    const users = await this.userModel.find({ _id: { $in: userIds } }).select('email phone').lean();
    const userById = new Map(users.map((u) => [u._id.toString(), u]));

    const data = requests.map((r) => ({
      ...this.toCorrectionRequestView(r),
      employeeEmail: userById.get(r.userId.toString())?.email,
      employeePhone: userById.get(r.userId.toString())?.phone,
    }));
    return { success: true, data };
  }

  /** Partner owner/admin approves or rejects a rider/staff-filed correction request. Approval
   * reuses correctRecord so the resulting AttendanceRecord edit is validated and audited exactly
   * like a direct partner correction. */
  async reviewCorrectionRequest(
    tenantId: string,
    requestId: string,
    reviewerUserId: string,
    dto: ReviewCorrectionRequestDto,
  ) {
    const request = await this.correctionRequestModel.findOne({
      _id: requestId,
      partnerId: new Types.ObjectId(tenantId),
    });
    if (!request) throw new NotFoundException('Correction request not found');
    if (request.status !== 'pending') {
      throw new ConflictException('This request has already been reviewed');
    }

    if (dto.action === 'approve') {
      await this.correctRecord(tenantId, request.recordId.toString(), reviewerUserId, {
        clockInAt: request.requestedClockInAt?.toISOString(),
        clockOutAt: request.requestedClockOutAt ? request.requestedClockOutAt.toISOString() : undefined,
      });
    }

    request.status = dto.action === 'approve' ? 'approved' : 'rejected';
    request.reviewedBy = new Types.ObjectId(reviewerUserId);
    request.reviewedAt = new Date();
    if (dto.reviewNote !== undefined) request.reviewNote = dto.reviewNote;
    await request.save();

    const view = this.toCorrectionRequestView(request);
    this.notifyPartner(request.partnerId, { type: 'correction_request_reviewed', request: view });
    void this.notifyEmployeeOfReview(request);
    return { success: true, data: view };
  }

  /** The partner-facing realtime event above only reaches the partner's own dashboard socket
   * room — the rider/staff member who filed the request has no other way to learn the outcome
   * short of reopening the attendance tab. Push/in-app notification is a best-effort side
   * effect and must never fail the review mutation itself. */
  private async notifyEmployeeOfReview(request: AttendanceCorrectionRequestDocument) {
    try {
      const approved = request.status === 'approved';
      await this.notificationDispatch.dispatch({
        userId: request.userId.toString(),
        title: approved ? 'Shift adjustment approved' : 'Shift adjustment rejected',
        body: approved
          ? `Your ${request.workDate} shift adjustment was approved.`
          : `Your ${request.workDate} shift adjustment was rejected.${request.reviewNote ? ` "${request.reviewNote}"` : ''}`,
        data: {
          type: 'attendance_correction_reviewed',
          recordId: request.recordId.toString(),
          status: request.status,
          workDate: request.workDate,
        },
      });
    } catch {
      // Best-effort — the review itself already succeeded and is the authoritative outcome.
    }
  }

  private toCorrectionRequestView(r: AttendanceCorrectionRequestDocument) {
    return {
      _id: r._id.toString(),
      recordId: r.recordId.toString(),
      userId: r.userId.toString(),
      partnerId: r.partnerId.toString(),
      role: r.role,
      workDate: r.workDate,
      originalClockInAt: r.originalClockInAt.toISOString(),
      originalClockOutAt: r.originalClockOutAt?.toISOString(),
      requestedClockInAt: r.requestedClockInAt?.toISOString(),
      requestedClockOutAt: r.requestedClockOutAt?.toISOString(),
      reason: r.reason,
      status: r.status,
      reviewedAt: r.reviewedAt?.toISOString(),
      reviewNote: r.reviewNote,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private toRecordView(r: AttendanceRecordDocument) {
    return {
      _id: r._id.toString(),
      userId: r.userId.toString(),
      partnerId: r.partnerId.toString(),
      role: r.role,
      branchId: r.branchId?.toString(),
      workDate: r.workDate,
      clockInAt: r.clockInAt.toISOString(),
      clockOutAt: r.clockOutAt?.toISOString(),
      status: r.status,
      notes: r.notes,
      source: r.source,
    };
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
  }
}
