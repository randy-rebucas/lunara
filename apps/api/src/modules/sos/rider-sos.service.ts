import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '@lunara/types';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { NotificationDispatchService } from '../push/notification-dispatch.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Rider, RiderDocument } from '../riders/schemas/rider.schema';
import {
  buildSosAlertPayload,
  isActiveSosOrderStatus,
} from './sos-utils';
import {
  SosIncident,
  SosIncidentDocument,
  SosIncidentStatus,
} from './schemas/sos-incident.schema';

@Injectable()
export class RiderSosService {
  constructor(
    @InjectModel(SosIncident.name) private incidentModel: Model<SosIncidentDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Rider.name) private riderModel: Model<RiderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => TrackingGateway))
    private trackingGateway: TrackingGateway,
    private notificationDispatch: NotificationDispatchService,
  ) {}

  async notifyDispatch(riderUserId: string, orderId: string, lat?: number, lng?: number) {
    const { rider, order, incident } = await this.ensureActiveIncident(
      riderUserId,
      orderId,
      lat,
      lng,
    );

    incident.dispatchNotifiedAt = new Date();
    if (lat !== undefined && lng !== undefined) {
      incident.lastLocation = { lat, lng, recordedAt: new Date() };
    }
    await incident.save();

    const riderName = await this.getRiderDisplayName(riderUserId);
    const alert = buildSosAlertPayload({
      incidentId: incident._id.toString(),
      orderId,
      riderUserId,
      riderName,
      lat: incident.lastLocation?.lat,
      lng: incident.lastLocation?.lng,
    });
    this.trackingGateway.emitAdminDispatcherAlert(alert);
    await this.notifyAdminsPush(orderId, incident._id.toString(), riderName);

    return {
      success: true,
      data: {
        incidentId: incident._id.toString(),
        dispatchNotified: true,
        riderId: rider._id.toString(),
        orderStatus: order.status,
      },
    };
  }

  async startLocationSharing(riderUserId: string, orderId: string, lat?: number, lng?: number) {
    const { incident } = await this.ensureActiveIncident(riderUserId, orderId, lat, lng);

    incident.locationSharingStartedAt = new Date();
    incident.locationSharingStoppedAt = undefined;
    if (lat !== undefined && lng !== undefined) {
      incident.lastLocation = { lat, lng, recordedAt: new Date() };
    }
    await incident.save();

    if (incident.lastLocation) {
      await this.emitSosLocationUpdate(incident, riderUserId);
    }

    return {
      success: true,
      data: {
        incidentId: incident._id.toString(),
        sharingActive: true,
      },
    };
  }

  async stopLocationSharing(riderUserId: string, orderId: string) {
    const incident = await this.incidentModel.findOne({
      riderUserId: new Types.ObjectId(riderUserId),
      orderId: new Types.ObjectId(orderId),
      status: SosIncidentStatus.ACTIVE,
    });
    if (!incident) throw new NotFoundException('No active SOS incident for this order');

    incident.locationSharingStoppedAt = new Date();
    await incident.save();

    return {
      success: true,
      data: {
        incidentId: incident._id.toString(),
        sharingActive: false,
      },
    };
  }

  async resolveIncident(incidentId: string) {
    const incident = await this.incidentModel.findById(incidentId);
    if (!incident) throw new NotFoundException('SOS incident not found');
    if (incident.status === SosIncidentStatus.RESOLVED) {
      return { success: true, data: { incidentId, resolved: true } };
    }

    incident.status = SosIncidentStatus.RESOLVED;
    incident.resolvedAt = new Date();
    incident.locationSharingStoppedAt = incident.locationSharingStoppedAt ?? new Date();
    await incident.save();

    return { success: true, data: { incidentId, resolved: true } };
  }

  async listActiveIncidents() {
    const incidents = await this.incidentModel
      .find({ status: SosIncidentStatus.ACTIVE })
      .sort({ updatedAt: -1 });

    const riderUserIds = incidents.map((i) => i.riderUserId);
    const users = await this.userModel.find({ _id: { $in: riderUserIds } }).select('email');
    const nameByUserId = new Map(
      users.map((u) => [u._id.toString(), u.email?.split('@')[0] ?? 'Rider']),
    );

    return {
      success: true,
      data: incidents.map((incident) => ({
        incidentId: incident._id.toString(),
        orderId: incident.orderId.toString(),
        riderUserId: incident.riderUserId.toString(),
        riderName: nameByUserId.get(incident.riderUserId.toString()) ?? 'Rider',
        dispatchNotifiedAt: incident.dispatchNotifiedAt,
        locationSharingStartedAt: incident.locationSharingStartedAt,
        locationSharingActive: Boolean(
          incident.locationSharingStartedAt &&
            (!incident.locationSharingStoppedAt ||
              incident.locationSharingStartedAt > incident.locationSharingStoppedAt),
        ),
        lastLocation: incident.lastLocation
          ? {
              lat: incident.lastLocation.lat,
              lng: incident.lastLocation.lng,
              recordedAt: incident.lastLocation.recordedAt,
            }
          : null,
        updatedAt: incident.updatedAt,
      })),
    };
  }

  async recordSosLocation(
    riderUserId: string,
    orderId: string,
    lat: number,
    lng: number,
  ): Promise<boolean> {
    const incident = await this.findSharingIncident(riderUserId, orderId);
    if (!incident) return false;

    incident.lastLocation = { lat, lng, recordedAt: new Date() };
    await incident.save();
    await this.emitSosLocationUpdate(incident, riderUserId, lat, lng);
    return true;
  }

  async isLocationSharingActive(riderUserId: string, orderId: string): Promise<boolean> {
    return Boolean(await this.findSharingIncident(riderUserId, orderId));
  }

  private async findSharingIncident(riderUserId: string, orderId: string) {
    const incident = await this.incidentModel.findOne({
      riderUserId: new Types.ObjectId(riderUserId),
      orderId: new Types.ObjectId(orderId),
      status: SosIncidentStatus.ACTIVE,
      locationSharingStartedAt: { $exists: true },
    });
    if (!incident) return null;
    if (
      incident.locationSharingStoppedAt &&
      incident.locationSharingStoppedAt >= incident.locationSharingStartedAt!
    ) {
      return null;
    }
    return incident;
  }

  private async ensureActiveIncident(
    riderUserId: string,
    orderId: string,
    lat?: number,
    lng?: number,
  ) {
    const order = await this.assertRiderActiveOrder(riderUserId, orderId);
    const rider = await this.riderModel.findOne({ userId: new Types.ObjectId(riderUserId) });
    if (!rider) throw new NotFoundException('Rider profile not found');

    let incident = await this.incidentModel.findOne({
      riderUserId: new Types.ObjectId(riderUserId),
      orderId: new Types.ObjectId(orderId),
      status: SosIncidentStatus.ACTIVE,
    });

    if (!incident) {
      incident = await this.incidentModel.create({
        riderUserId: new Types.ObjectId(riderUserId),
        riderId: rider._id,
        orderId: new Types.ObjectId(orderId),
        status: SosIncidentStatus.ACTIVE,
        lastLocation:
          lat !== undefined && lng !== undefined
            ? { lat, lng, recordedAt: new Date() }
            : undefined,
      });
    }

    return { rider, order, incident };
  }

  private async assertRiderActiveOrder(riderUserId: string, orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const riderObjectId = new Types.ObjectId(riderUserId);
    const isPickupRider = order.pickupRiderId?.equals(riderObjectId);
    const isDeliveryRider = order.deliveryRiderId?.equals(riderObjectId);
    if (!isPickupRider && !isDeliveryRider) {
      throw new ForbiddenException('You are not assigned to this order');
    }
    if (!isActiveSosOrderStatus(order.status)) {
      throw new BadRequestException('SOS is only available during active tasks');
    }

    return order;
  }

  private async getRiderDisplayName(riderUserId: string) {
    const user = await this.userModel.findById(riderUserId).select('email');
    return user?.email?.split('@')[0] ?? 'Rider';
  }

  private async emitSosLocationUpdate(
    incident: SosIncidentDocument,
    riderUserId: string,
    lat?: number,
    lng?: number,
  ) {
    const coords = {
      lat: lat ?? incident.lastLocation?.lat,
      lng: lng ?? incident.lastLocation?.lng,
    };
    if (coords.lat === undefined || coords.lng === undefined) return;

    const riderName = await this.getRiderDisplayName(riderUserId);
    this.trackingGateway.emitSosLocationUpdate({
      incidentId: incident._id.toString(),
      orderId: incident.orderId.toString(),
      riderUserId,
      riderName,
      lat: coords.lat,
      lng: coords.lng,
      timestamp: new Date().toISOString(),
    });
  }

  private async notifyAdminsPush(orderId: string, incidentId: string, riderName: string) {
    const admins = await this.userModel.find({ role: UserRole.ADMIN }).select('_id');
    await Promise.all(
      admins.map((admin) =>
        this.notificationDispatch.dispatch({
          userId: admin._id.toString(),
          title: 'Rider SOS alert',
          body: `${riderName} requested immediate assistance on order ${orderId.slice(-6)}`,
          channelId: 'default',
          data: {
            type: 'rider_sos',
            orderId,
            incidentId,
            riderName,
          },
        }),
      ),
    );
  }
}
