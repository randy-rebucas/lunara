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
