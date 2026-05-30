import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum RefundReviewAction {
  START_REVIEW = 'start_review',
  VERIFY_ORDER = 'verify_order',
  APPROVE = 'approve',
  REJECT = 'reject',
  PROCESS = 'process',
  NOTIFY = 'notify',
}

export class ReviewRefundDto {
  @IsEnum(RefundReviewAction)
  action!: RefundReviewAction;

  @IsOptional()
  @IsString()
  adminNote?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  approvedAmount?: number;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
