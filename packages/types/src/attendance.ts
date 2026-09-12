/** Mirrors apps/api/src/modules/attendance/attendance.service.ts's toRecordView() shape. */
export interface AttendanceRecordView {
  _id: string;
  userId: string;
  partnerId: string;
  role: 'staff' | 'rider';
  branchId?: string;
  workDate: string;
  clockInAt: string;
  clockOutAt?: string;
  status: 'active' | 'completed';
  notes?: string;
  source: 'mobile' | 'partner_correction';
}

export interface PartnerAttendanceRecord extends AttendanceRecordView {
  employeeEmail?: string;
  employeePhone?: string;
}

export interface PartnerAttendanceSummary {
  workDate: string;
  activeStaff: number;
  activeRiders: number;
  totalEmployeesToday: number;
  totalStaffHoursToday: number;
  totalRiderHoursToday: number;
}

/** An employee-initiated request to amend one of their own AttendanceRecord sessions — see
 * apps/api's attendance-correction-request.schema.ts for the distinction from a direct
 * partner_correction (which a partner owner/admin makes without a request/approval step). */
export interface AttendanceCorrectionRequestView {
  _id: string;
  recordId: string;
  userId: string;
  partnerId: string;
  role: 'staff' | 'rider';
  workDate: string;
  originalClockInAt: string;
  originalClockOutAt?: string;
  requestedClockInAt?: string;
  requestedClockOutAt?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
}

export interface PartnerAttendanceCorrectionRequest extends AttendanceCorrectionRequestView {
  employeeEmail?: string;
  employeePhone?: string;
}
