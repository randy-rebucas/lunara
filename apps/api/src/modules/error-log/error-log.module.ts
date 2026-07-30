import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ErrorLog, ErrorLogSchema } from './schemas/error-log.schema';
import { ErrorLogService } from './error-log.service';
import { ErrorLogController, ClientErrorReportController } from './error-log.controller';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: ErrorLog.name, schema: ErrorLogSchema }])],
  controllers: [ErrorLogController, ClientErrorReportController],
  providers: [ErrorLogService],
  exports: [ErrorLogService],
})
export class ErrorLogModule {}
