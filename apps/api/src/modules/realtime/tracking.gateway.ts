import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
import type { ChatMessage, JwtPayload } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { normalizeRiderLocationPayload, riderLocationWirePayload } from '@lunara/utils';
import { getJwtSecret } from '../../common/config/jwt-config';
import { getAllowedOrigins } from '../../common/config/cors-config';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Conversation, ConversationDocument } from '../messaging/schemas/conversation.schema';
import { RiderSosService } from '../sos/rider-sos.service';
import { CustomerOrderNotificationService } from '../push/customer-order-notification.service';
import { PartnerOrderNotificationService } from '../push/partner-order-notification.service';

@Injectable()
@WebSocketGateway({ cors: { origin: getAllowedOrigins(), credentials: true }, namespace: '/tracking' })
export class TrackingGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TrackingGateway.name);
  private readonly customerIdByOrderId = new Map<string, string>();
  private static readonly MAX_CACHED_CUSTOMER_IDS = 10_000;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @Inject(forwardRef(() => RiderSosService))
    private readonly riderSosService: RiderSosService,
    private readonly customerOrderNotifications: CustomerOrderNotificationService,
    @Inject(forwardRef(() => PartnerOrderNotificationService))
    private readonly partnerOrderNotifications: PartnerOrderNotificationService,
  ) {}

  handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: getJwtSecret(),
      });
      client.data.user = payload;
    } catch {
      client.disconnect(true);
    }
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) return authToken;

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return undefined;
  }

  private getUser(client: Socket): JwtPayload | null {
    return (client.data.user as JwtPayload | undefined) ?? null;
  }

  @SubscribeMessage('joinOrder')
  async handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    const user = this.getUser(client);
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }
    if (!data?.orderId) {
      return { success: false, error: 'orderId required' };
    }

    if (user.role === UserRole.CUSTOMER) {
      const customerId = await this.resolveCustomerId(data.orderId);
      if (!customerId || customerId !== user.sub) {
        return { success: false, error: 'Forbidden' };
      }
    }

    client.join(`order:${data.orderId}`);
    return { success: true, room: `order:${data.orderId}` };
  }

  @SubscribeMessage('joinCustomer')
  handleJoinCustomer(@ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (!user || user.role !== UserRole.CUSTOMER) {
      return { success: false, error: 'Forbidden' };
    }
    client.join(`customer:${user.sub}`);
    return { success: true, room: `customer:${user.sub}` };
  }

  @SubscribeMessage('riderLocation')
  handleRiderLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      orderId: string;
      riderId: string;
      lat?: number;
      lng?: number;
      latitude?: number;
      longitude?: number;
      speed?: number;
      heading?: number;
      timestamp?: string;
    },
  ) {
    const user = this.getUser(client);
    if (!user || user.role !== UserRole.RIDER) {
      return { success: false, error: 'Forbidden' };
    }
    if (data.riderId !== user.sub) {
      this.logger.warn(`Rider ${user.sub} attempted to emit location as ${data.riderId}`);
      return { success: false, error: 'Forbidden' };
    }

    let normalized;
    try {
      normalized = normalizeRiderLocationPayload(data);
    } catch {
      return { success: false, error: 'Invalid location payload' };
    }

    const wire = riderLocationWirePayload(normalized);
    this.server.to(`order:${data.orderId}`).emit('locationUpdate', {
      orderId: data.orderId,
      riderId: data.riderId,
      ...wire,
    });

    void this.riderSosService.recordSosLocation(
      user.sub,
      data.orderId,
      normalized.latitude,
      normalized.longitude,
    );

    return { success: true };
  }

  @SubscribeMessage('sosLocation')
  handleSosLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      orderId: string;
      lat?: number;
      lng?: number;
      latitude?: number;
      longitude?: number;
      speed?: number;
      heading?: number;
      timestamp?: string;
    },
  ) {
    const user = this.getUser(client);
    if (!user || user.role !== UserRole.RIDER) {
      return { success: false, error: 'Forbidden' };
    }
    if (!data?.orderId) {
      return { success: false, error: 'orderId required' };
    }

    let normalized;
    try {
      normalized = normalizeRiderLocationPayload(data);
    } catch {
      return { success: false, error: 'Invalid location payload' };
    }

    void this.riderSosService.recordSosLocation(
      user.sub,
      data.orderId,
      normalized.latitude,
      normalized.longitude,
    );
    return { success: true };
  }

  emitOrderStatus(orderId: string, status: string) {
    const payload = { orderId, status };
    this.server.to(`order:${orderId}`).emit('orderStatusUpdate', payload);
    void this.emitToCustomerRoom(orderId, 'orderStatusUpdate', payload);
    void this.partnerOrderNotifications.notifyOrderStatus(orderId, status);
  }

  emitOrderEvent(orderId: string, event: string, payload: Record<string, unknown>) {
    const full = { orderId, event, ...payload };
    this.server.to(`order:${orderId}`).emit('orderEvent', full);
    void this.emitToCustomerRoom(orderId, 'orderEvent', full);
    void this.customerOrderNotifications.notifyOrderEvent(orderId, event, payload);
    void this.partnerOrderNotifications.notifyOrderEvent(orderId, event, payload);
  }

  private async resolveCustomerId(orderId: string): Promise<string | undefined> {
    const cached = this.customerIdByOrderId.get(orderId);
    if (cached) return cached;

    const order = await this.orderModel.findById(orderId).select('customerId').lean();
    const customerId = order?.customerId?.toString();
    if (customerId) {
      if (this.customerIdByOrderId.size >= TrackingGateway.MAX_CACHED_CUSTOMER_IDS) {
        const oldestKey = this.customerIdByOrderId.keys().next().value;
        if (oldestKey !== undefined) this.customerIdByOrderId.delete(oldestKey);
      }
      this.customerIdByOrderId.set(orderId, customerId);
    }
    return customerId;
  }

  private async emitToCustomerRoom(
    orderId: string,
    event: 'orderStatusUpdate' | 'orderEvent',
    payload: Record<string, unknown>,
  ) {
    const customerId = await this.resolveCustomerId(orderId);
    if (!customerId) return;
    this.server.to(`customer:${customerId}`).emit(event, payload);
  }

  emitPickupOffer(offer: Record<string, unknown>) {
    this.server.to('riders:online').emit('pickupOffer', offer);
  }

  emitDeliveryOffer(offer: Record<string, unknown>) {
    this.server.to('riders:online').emit('deliveryOffer', offer);
  }

  emitRiderAssignment(riderUserId: string, payload: Record<string, unknown>) {
    this.server.to(`rider:${riderUserId}`).emit('pickupAssignment', payload);
    this.server.to('riders:online').emit('pickupAssignment', payload);
  }

  emitDeliveryAssignment(riderUserId: string, payload: Record<string, unknown>) {
    this.server.to(`rider:${riderUserId}`).emit('deliveryAssignment', payload);
    this.server.to('riders:online').emit('deliveryAssignment', payload);
  }

  /** In-app notification created for a rider (assignments, alerts). */
  emitRiderNotification(riderUserId: string, payload: Record<string, unknown>) {
    this.server.to(`rider:${riderUserId}`).emit('riderNotification', payload);
  }

  /** In-app notification for partner portal users. */
  emitPartnerNotification(userId: string, payload: Record<string, unknown>) {
    this.server.to(`portal:${userId}`).emit('partnerNotification', payload);
  }

  emitPartnerNotificationToRoom(partnerId: string, payload: Record<string, unknown>) {
    this.server.to(`partner:${partnerId}`).emit('partnerNotification', payload);
  }

  emitPartnerNotificationToBranch(branchId: string, payload: Record<string, unknown>) {
    this.server.to(`branch:${branchId}`).emit('partnerNotification', payload);
  }

  /** Alerts admin dispatcher UI (control tower). */
  emitAdminDispatcherAlert(payload: Record<string, unknown>) {
    this.server.to('admin:operations').emit('dispatcherAlert', payload);
  }

  /** Live SOS location for admin dispatchers. */
  emitSosLocationUpdate(payload: Record<string, unknown>) {
    this.server.to('admin:operations').emit('sosLocationUpdate', payload);
  }

  /** Refresh admin dispatch queue when counts may have changed. */
  emitDispatchQueueUpdated(payload: Record<string, unknown> = {}) {
    this.server.to('admin:operations').emit('dispatchQueueUpdated', {
      ...payload,
      at: new Date().toISOString(),
    });
  }

  /** Refresh admin laundry-tag pool view when a tag's status changes (assigned/released/retired/generated). */
  emitLaundryTagsUpdated(payload: Record<string, unknown> = {}) {
    this.server.to('admin:operations').emit('laundryTagsUpdated', {
      ...payload,
      at: new Date().toISOString(),
    });
  }

  /** Notify partner portal / branch rooms that laundry pipeline changed. */
  emitPartnerPipelineUpdated(params: {
    orderId: string;
    status?: string;
    partnerId?: string | null;
    branchId?: string | null;
  }) {
    const payload = { orderId: params.orderId, status: params.status };
    if (params.partnerId) {
      this.server.to(`partner:${params.partnerId}`).emit('partnerPipelineUpdated', payload);
    }
    if (params.branchId) {
      this.server.to(`branch:${params.branchId}`).emit('branchPipelineUpdated', payload);
    }
  }

  @SubscribeMessage('joinAdminOperations')
  handleJoinAdminOperations(@ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (!user || user.role !== UserRole.ADMIN) {
      return { success: false, error: 'Forbidden' };
    }
    client.join('admin:operations');
    return { success: true };
  }

  @SubscribeMessage('joinPartnerPortal')
  handleJoinPartnerPortal(@ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (
      !user ||
      (user.role !== UserRole.PARTNER &&
        user.role !== UserRole.STAFF &&
        user.role !== UserRole.ADMIN)
    ) {
      return { success: false, error: 'Forbidden' };
    }
    client.join(`portal:${user.sub}`);
    if (user.role === UserRole.PARTNER) {
      client.join(`partner:${user.sub}`);
    }
    return { success: true, room: `portal:${user.sub}` };
  }

  @SubscribeMessage('joinPartnerOperations')
  handleJoinPartnerOperations(@ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (!user || user.role !== UserRole.PARTNER) {
      return { success: false, error: 'Forbidden' };
    }
    client.join(`partner:${user.sub}`);
    client.join(`portal:${user.sub}`);
    return { success: true, room: `partner:${user.sub}` };
  }

  @SubscribeMessage('joinBranch')
  handleJoinBranch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { branchId: string },
  ) {
    const user = this.getUser(client);
    if (!user) return { success: false, error: 'Unauthorized' };
    if (
      user.role !== UserRole.PARTNER &&
      user.role !== UserRole.STAFF &&
      user.role !== UserRole.ADMIN
    ) {
      return { success: false, error: 'Forbidden' };
    }
    if (!data?.branchId) return { success: false, error: 'branchId required' };
    client.join(`branch:${data.branchId}`);
    client.join(`portal:${user.sub}`);
    return { success: true, room: `branch:${data.branchId}` };
  }

  @SubscribeMessage('joinRider')
  handleJoinRider(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    const user = this.getUser(client);
    if (!user || user.role !== UserRole.RIDER) {
      return { success: false, error: 'Forbidden' };
    }
    if (data?.userId && data.userId !== user.sub) {
      return { success: false, error: 'Forbidden' };
    }
    client.join(`rider:${user.sub}`);
    return { success: true };
  }

  @SubscribeMessage('joinRiders')
  handleJoinRiders(@ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (!user || user.role !== UserRole.RIDER) {
      return { success: false, error: 'Forbidden' };
    }
    client.join('riders:online');
    return { success: true };
  }

  @SubscribeMessage('leaveRiders')
  handleLeaveRiders(@ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (!user || user.role !== UserRole.RIDER) {
      return { success: false, error: 'Forbidden' };
    }
    client.leave('riders:online');
    return { success: true };
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = this.getUser(client);
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!data?.conversationId) return { success: false, error: 'conversationId required' };

    // Admins may join any conversation room; partners must own it
    if (user.role !== UserRole.ADMIN) {
      const convo = await this.conversationModel
        .findById(data.conversationId)
        .select('partnerId')
        .lean()
        .catch(() => null);
      if (!convo || convo.partnerId.toString() !== user.sub) {
        return { success: false, error: 'Forbidden' };
      }
    }

    client.join(`conversation:${data.conversationId}`);
    return { success: true, room: `conversation:${data.conversationId}` };
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId) return { success: false, error: 'conversationId required' };
    client.leave(`conversation:${data.conversationId}`);
    return { success: true };
  }

  emitNewMessage(conversationId: string, message: ChatMessage) {
    this.server.to(`conversation:${conversationId}`).emit('newMessage', message);
  }
}
