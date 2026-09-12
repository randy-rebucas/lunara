import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { Rider, RiderSchema } from '../riders/schemas/rider.schema';
import { RealtimeModule } from '../realtime/realtime.module';
import { AttendanceController } from './attendance.controller';
import { PartnerAttendanceController } from './partner-attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceRecord, AttendanceRecordSchema } from './schemas/attendance-record.schema';
import {
  AttendanceCorrectionRequest,
  AttendanceCorrectionRequestSchema,
} from './schemas/attendance-correction-request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AttendanceRecord.name, schema: AttendanceRecordSchema },
      { name: AttendanceCorrectionRequest.name, schema: AttendanceCorrectionRequestSchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Rider.name, schema: RiderSchema },
    ]),
    RealtimeModule,
  ],
  controllers: [AttendanceController, PartnerAttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
