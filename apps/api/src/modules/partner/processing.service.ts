import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
import {
  canTransitionOrderStatus,
  getInitialProcessingStepForOrder,
  getNextProcessingStep,
  getProcessingStep,
  isProcessingComplete,
  formatPartnerPreProcessingLabel,
  LAUNDRY_PROCESSING_STEPS,
  normalizeProcessingStepId,
  PARTNER_PROCESSING_QUEUE_STATUSES,
  type LaundryProcessingStepId,
} from '@lunara/utils';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import {
  buildOrderPaymentSummary,
  buildPartnerPaymentLabel,
  loadLatestOrderPaymentsByOrderId,
} from '../payments/payment-summary';
import { AdvanceProcessingDto } from './dto/processing.dto';
import {
  applyStaffBranchFilter,
  assertOrderPortalAccess,
  resolvePortalBranchId,
} from './partner-access';

@Injectable()
export class ProcessingService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private trackingGateway: TrackingGateway,
    private riderAssignmentService: RiderAssignmentService,
  ) {}

  getConfig() {
    return {
      success: true,
      data: {
        steps: LAUNDRY_PROCESSING_STEPS,
        queueStatuses: PARTNER_PROCESSING_QUEUE_STATUSES,
      },
    };
  }

  async getQueue(
    staffUserId?: string,
    mineOnly?: boolean,
    partnerUserId?: string,
    role?: UserRole,
  ) {
    const filter: Record<string, unknown> = {
      status: { $in: PARTNER_PROCESSING_QUEUE_STATUSES },
      dispatchStatus: 'dispatched',
      branchId: { $exists: true, $ne: null },
    };
    if (mineOnly && staffUserId) {
      filter['laundryProcessing.assignedStaffId'] = new Types.ObjectId(staffUserId);
    }
    if (role === UserRole.PARTNER && partnerUserId) {
      filter.partnerId = new Types.ObjectId(partnerUserId);
    }
    if (role === UserRole.STAFF && staffUserId) {
      const branchId = await resolvePortalBranchId(this.userModel, staffUserId, role);
      applyStaffBranchFilter(filter, role, branchId);
    }

    const items = await this.orderModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(100);

    const paymentsByOrderId = await loadLatestOrderPaymentsByOrderId(
      this.paymentModel,
      items.map((o) => o._id),
    );

    const counts = items.reduce(
      (acc, order) => {
        acc[order.status] = (acc[order.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      success: true,
      data: {
        items: items.map((o) => this.summarizeOrder(o, paymentsByOrderId)),
        counts,
      },
    };
  }

  async getOrderProcessing(orderId: string, userId: string, role: UserRole) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');
    const branchId = await resolvePortalBranchId(this.userModel, userId, role);
    assertOrderPortalAccess(order, userId, role, branchId);
    if (!PARTNER_PROCESSING_QUEUE_STATUSES.includes(order.status)) {
      return { success: true, data: this.buildPreProcessingView(order) };
    }
    return { success: true, data: this.buildProcessingView(order) };
  }

  async acceptJob(orderId: string, userId: string, role: UserRole) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const branchId = await resolvePortalBranchId(this.userModel, userId, role);
    assertOrderPortalAccess(order, userId, role, branchId);

    if (!PARTNER_PROCESSING_QUEUE_STATUSES.includes(order.status)) {
      throw new BadRequestException('Order is not in the processing queue');
    }

    if (!order.laundryProcessing) {
      order.laundryProcessing = { completedSteps: [], ironingSkipped: false };
    }

    const assigned = order.laundryProcessing.assignedStaffId?.toString();
    if (assigned && assigned !== userId && role === UserRole.STAFF) {
      throw new BadRequestException('This job was already accepted by another staff member');
    }

    order.laundryProcessing.assignedStaffId = new Types.ObjectId(userId);
    order.laundryProcessing.assignedAt = new Date();
    if (!order.laundryProcessing.startedAt) {
      order.laundryProcessing.startedAt = new Date();
    }
    await order.save();

    this.trackingGateway.emitOrderEvent(orderId, 'staffJobAccepted', {
      message: 'A staff member accepted this order for processing',
      staffId: userId,
    });
    this.trackingGateway.emitPartnerPipelineUpdated({
      orderId,
      status: order.status,
      partnerId: order.partnerId?.toString(),
      branchId: order.branchId?.toString(),
    });

    return { success: true, data: this.buildProcessingView(order) };
  }

  async advance(orderId: string, userId: string, role: UserRole, dto: AdvanceProcessingDto) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const branchId = await resolvePortalBranchId(this.userModel, userId, role);
    assertOrderPortalAccess(order, userId, role, branchId);

    if (!PARTNER_PROCESSING_QUEUE_STATUSES.includes(order.status)) {
      throw new BadRequestException(`Order status ${order.status} is not in processing queue`);
    }

    if (order.laundryProcessing?.completedAt) {
      throw new BadRequestException('Laundry processing already completed for this order');
    }

    if (!order.laundryProcessing) order.laundryProcessing = { completedSteps: [], ironingSkipped: false };

    const assigned = order.laundryProcessing.assignedStaffId?.toString();
    if (role === UserRole.STAFF && assigned && assigned !== userId) {
      throw new BadRequestException('This job is assigned to another staff member');
    }
    if (role === UserRole.STAFF && !assigned) {
      throw new BadRequestException('Accept this job or wait for partner assignment');
    }

    if (!order.laundryProcessing.startedAt) order.laundryProcessing.startedAt = new Date();

    const currentStepId = this.resolveCurrentStepId(order);
    const currentStep = getProcessingStep(currentStepId);
    if (!currentStep) throw new BadRequestException('Invalid processing state');

    const skipIroning = dto.skipIroning ?? order.laundryProcessing.ironingSkipped;
    if (currentStepId === 'folding' && dto.skipIroning) {
      order.laundryProcessing.ironingSkipped = true;
    }

    order.laundryProcessing.completedSteps.push({
      stepId: currentStepId,
      completedAt: new Date(),
      note: dto.note,
      verifiedWeightKg: dto.verifiedWeightKg,
      tagCode: dto.tagCode,
      photoUrl: dto.photoUrl,
    });

    if (dto.verifiedWeightKg != null) {
      order.laundryProcessing.verifiedWeightKg = dto.verifiedWeightKg;
    }

    await this.transitionOrderStatus(order, currentStep.orderStatus, userId, currentStep.label);

    const next = getNextProcessingStep(currentStepId, { skipIroning });
    if (!next) {
      order.laundryProcessing.completedAt = new Date();
      order.laundryProcessing.currentStepId = 'ready_for_delivery';
    } else {
      order.laundryProcessing.currentStepId = next.id;
    }

    await order.save();

    this.trackingGateway.emitOrderStatus(orderId, order.status);
    this.trackingGateway.emitOrderEvent(orderId, 'processingAdvanced', {
      message: `Laundry: ${currentStep.label} complete`,
      stepId: currentStepId,
      nextStepId: next?.id,
    });
    this.trackingGateway.emitPartnerPipelineUpdated({
      orderId,
      status: order.status,
      partnerId: order.partnerId?.toString(),
      branchId: order.branchId?.toString(),
    });

    if (order.status === OrderStatus.READY_FOR_DELIVERY) {
      await this.riderAssignmentService.notifyAwaitingDeliveryDispatch(orderId);
    }

    return { success: true, data: this.buildProcessingView(order) };
  }

  async registerProcessingPhoto(
    orderId: string,
    userId: string,
    role: UserRole,
    photoUrl: string,
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const branchId = await resolvePortalBranchId(this.userModel, userId, role);
    assertOrderPortalAccess(order, userId, role, branchId);

    return { success: true, data: { photoUrl } };
  }

  private resolveCurrentStepId(order: OrderDocument): LaundryProcessingStepId {
    const stored = normalizeProcessingStepId(order.laundryProcessing?.currentStepId);
    if (stored) return stored;
    const initial = getInitialProcessingStepForOrder(order.status);
    if (initial) return initial;
    if (order.status === OrderStatus.RECEIVED_AT_SHOP) return 'received';
    throw new BadRequestException(`Order status ${order.status} is not in laundry processing`);
  }

  private async transitionOrderStatus(
    order: OrderDocument,
    nextStatus: OrderStatus,
    userId: string,
    note: string,
  ) {
    if (order.status === nextStatus) return;
    if (!canTransitionOrderStatus(order.status, nextStatus)) {
      throw new BadRequestException(`Cannot move order from ${order.status} to ${nextStatus}`);
    }
    order.status = nextStatus;
    order.statusHistory.push({
      status: nextStatus,
      timestamp: new Date(),
      note,
      updatedBy: userId,
    });
  }

  private summarizeOrder(
    order: OrderDocument,
    paymentsByOrderId?: Map<string, PaymentDocument>,
  ) {
    const currentStepId = order.laundryProcessing?.currentStepId
      ?? getInitialProcessingStepForOrder(order.status)
      ?? getInitialProcessingStepForOrder(order.status)
      ?? 'received';
    const step = getProcessingStep(currentStepId as LaundryProcessingStepId);
    const paymentSummary = buildOrderPaymentSummary(paymentsByOrderId?.get(order._id.toString()));
    const paymentLabel = buildPartnerPaymentLabel(paymentSummary);
    return {
      _id: order._id.toString(),
      status: order.status,
      bookingType: order.bookingType,
      total: order.total,
      estimatedWeightKg: order.estimatedWeightKg,
      verifiedWeightKg: order.laundryProcessing?.verifiedWeightKg,
      currentStepId,
      currentStepLabel: step?.label ?? currentStepId,
      progress: this.calcProgress(currentStepId as LaundryProcessingStepId),
      branchId: order.branchId?.toString(),
      assignedStaffId: order.laundryProcessing?.assignedStaffId?.toString(),
      isAssigned: !!order.laundryProcessing?.assignedStaffId,
      ...paymentSummary,
      paymentLabel,
    };
  }

  private buildPreProcessingView(order: OrderDocument) {
    const label = formatPartnerPreProcessingLabel(order.status);
    return {
      preProcessing: true,
      order: {
        _id: order._id.toString(),
        status: order.status,
        bookingType: order.bookingType,
        total: order.total,
        estimatedWeightKg: order.estimatedWeightKg,
        pickup: order.pickup,
      },
      processing: order.laundryProcessing,
      currentStep: {
        id: 'pre_processing',
        label,
        description:
          'Laundry processing starts after the rider delivers to your shop and you complete shop receiving.',
      },
      nextStep: null,
      steps: LAUNDRY_PROCESSING_STEPS,
      progress: 0,
      isComplete: false,
      canSkipIroning: false,
      assignedStaffId: order.laundryProcessing?.assignedStaffId?.toString(),
      isJobAccepted: false,
    };
  }

  private buildProcessingView(order: OrderDocument) {
    const currentStepId = this.resolveCurrentStepId(order);
    const currentStep = getProcessingStep(currentStepId);
    const nextStep = getNextProcessingStep(currentStepId, {
      skipIroning: order.laundryProcessing?.ironingSkipped,
    });

    return {
      order: {
        _id: order._id.toString(),
        status: order.status,
        bookingType: order.bookingType,
        total: order.total,
        estimatedWeightKg: order.estimatedWeightKg,
        pickup: order.pickup,
      },
      processing: order.laundryProcessing,
      currentStep,
      nextStep,
      steps: LAUNDRY_PROCESSING_STEPS,
      progress: this.calcProgress(currentStepId),
      isComplete: isProcessingComplete(currentStepId) && !!order.laundryProcessing?.completedAt,
      canSkipIroning: currentStepId === 'folding' || currentStepId === 'ironing',
      assignedStaffId: order.laundryProcessing?.assignedStaffId?.toString(),
      isJobAccepted: !!order.laundryProcessing?.assignedStaffId,
      lastStepPhoto: order.laundryProcessing?.completedSteps?.at(-1)?.photoUrl,
    };
  }

  private calcProgress(currentStepId: LaundryProcessingStepId) {
    const index = LAUNDRY_PROCESSING_STEPS.findIndex((s) => s.id === currentStepId);
    if (index < 0) return 0;
    return Math.round(((index + 1) / LAUNDRY_PROCESSING_STEPS.length) * 100);
  }
}
