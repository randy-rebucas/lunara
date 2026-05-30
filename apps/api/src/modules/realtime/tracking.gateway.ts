import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@lunara/types';
import { UserRole } from '@lunara/types';
import { getJwtSecret } from '../../common/config/jwt-config';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/tracking' })
export class TrackingGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

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
  handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (!this.getUser(client)) {
      return { success: false, error: 'Unauthorized' };
    }
    client.join(`order:${data.orderId}`);
    return { success: true, room: `order:${data.orderId}` };
  }

  @SubscribeMessage('riderLocation')
  handleRiderLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; lat: number; lng: number; riderId: string },
  ) {
    const user = this.getUser(client);
    if (!user || user.role !== UserRole.RIDER) {
      return { success: false, error: 'Forbidden' };
    }
    if (data.riderId !== user.sub) {
      this.logger.warn(`Rider ${user.sub} attempted to emit location as ${data.riderId}`);
      return { success: false, error: 'Forbidden' };
    }

    this.server.to(`order:${data.orderId}`).emit('locationUpdate', {
      orderId: data.orderId,
      riderId: data.riderId,
      lat: data.lat,
      lng: data.lng,
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  }

  emitOrderStatus(orderId: string, status: string) {
    this.server.to(`order:${orderId}`).emit('orderStatusUpdate', { orderId, status });
  }

  emitOrderEvent(orderId: string, event: string, payload: Record<string, unknown>) {
    this.server.to(`order:${orderId}`).emit('orderEvent', { orderId, event, ...payload });
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

  /** Alerts admin dispatcher UI (control tower). */
  emitAdminDispatcherAlert(payload: Record<string, unknown>) {
    this.server.to('admin:operations').emit('dispatcherAlert', payload);
  }

  /** Refresh admin dispatch queue when counts may have changed. */
  emitDispatchQueueUpdated(payload: Record<string, unknown> = {}) {
    this.server.to('admin:operations').emit('dispatchQueueUpdated', {
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

  @SubscribeMessage('joinPartnerOperations')
  handleJoinPartnerOperations(@ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (!user || user.role !== UserRole.PARTNER) {
      return { success: false, error: 'Forbidden' };
    }
    client.join(`partner:${user.sub}`);
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
}
