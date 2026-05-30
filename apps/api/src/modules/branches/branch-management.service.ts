import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, UserRole } from '@lunara/types';
import { BRANCH_TYPE_LABELS, type BranchPerformanceMetrics } from '@lunara/utils';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Branch, BranchDocument } from './schemas/branch.schema';

const DEFAULT_MACHINES = [
  { id: 'w1', label: 'Washer 1', machineType: 'washer', status: 'active', capacityKg: 15 },
  { id: 'w2', label: 'Washer 2', machineType: 'washer', status: 'active', capacityKg: 15 },
  { id: 'd1', label: 'Dryer 1', machineType: 'dryer', status: 'active', capacityKg: 20 },
  { id: 'f1', label: 'Folding station', machineType: 'folder', status: 'active', capacityKg: 10 },
];

const HQ_SEED = {
  code: 'HQ-01',
  name: 'Lunara HQ',
  line1: 'Lunara Network Operations',
  city: 'Makati',
  province: 'Metro Manila',
  coordinates: [121.0244, 14.5547] as [number, number],
};

export interface BranchTreeNode {
  id: string;
  code: string;
  name: string;
  branchType: Branch['branchType'];
  branchTypeLabel: string;
  parentBranchId?: string;
  isActive: boolean;
  city: string;
  childCount: number;
  children: BranchTreeNode[];
}

@Injectable()
export class BranchManagementService {
  constructor(
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private branchesService: BranchesService,
  ) {}

  operationalFilter() {
    return { isActive: true, branchType: { $ne: 'hq' as const } };
  }

  async ensureNetworkStructure() {
    const partner = await this.userModel.findOne({ email: 'partner@lunara.dev' });
    if (!partner) return;

    let hq = await this.branchModel.findOne({ branchType: 'hq' });
    if (!hq) {
      hq = await this.branchModel.create({
        ...HQ_SEED,
        branchType: 'hq',
        partnerUserId: partner._id,
        managerUserId: partner._id,
        maxActiveOrders: 0,
        maxWeightCapacityKg: 0,
        dailyQuotaOrders: 0,
        dailyQuotaWeightKg: 0,
        serviceRadiusKm: 0,
        machines: [],
        isActive: true,
        location: { type: 'Point', coordinates: HQ_SEED.coordinates },
      });
    }

    const opCount = await this.branchModel.countDocuments({ branchType: { $ne: 'hq' } });
    if (opCount === 0) {
      await this.seedOperationalBranches(partner._id, hq._id);
    }

    await this.branchModel.updateMany(
      {
        branchType: { $ne: 'hq' },
        $or: [{ parentBranchId: { $exists: false } }, { parentBranchId: null }],
      },
      { $set: { parentBranchId: hq._id } },
    );

    await this.branchModel.updateMany(
      { branchType: { $exists: false } },
      { $set: { branchType: 'partner_shop' } },
    );

    const shops = await this.branchModel.find({ branchType: { $ne: 'hq' } });
    for (const shop of shops) {
      const updates: Record<string, unknown> = {};
      if (!shop.managerUserId) updates.managerUserId = partner._id;
      if (!shop.dailyQuotaOrders) updates.dailyQuotaOrders = shop.maxActiveOrders ?? 25;
      if (!shop.dailyQuotaWeightKg) updates.dailyQuotaWeightKg = shop.maxWeightCapacityKg ?? 200;
      if (!shop.machines?.length) updates.machines = DEFAULT_MACHINES;
      if (Object.keys(updates).length > 0) {
        await this.branchModel.updateOne({ _id: shop._id }, { $set: updates });
      }
    }

    const makati = await this.branchModel.findOne({ code: 'MKT-01' });
    const staff = await this.userModel.findOne({ email: 'staff@lunara.dev' });
    if (makati && staff && !staff.branchId) {
      await this.userModel.updateOne(
        { _id: staff._id },
        { $set: { branchId: makati._id } },
      );
    }
  }

  async getNetworkTree() {
    await this.ensureNetworkStructure();
    const branches = await this.branchModel.find().sort({ name: 1 });
    const nodes = await Promise.all(
      branches.map((b) => this.serializeTreeNode(b, branches)),
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const roots: BranchTreeNode[] = [];

    for (const node of nodes) {
      if (node.parentBranchId && byId.has(node.parentBranchId)) {
        byId.get(node.parentBranchId)!.children.push(node);
      } else if (!node.parentBranchId || node.branchType === 'hq') {
        roots.push(node);
      }
    }

    for (const node of nodes) {
      node.childCount = this.countDescendants(node);
    }

    const hq = roots.find((r) => r.branchType === 'hq') ?? roots[0];
    return {
      success: true,
      data: {
        tree: hq ? [hq] : roots,
        totalBranches: branches.length,
        operationalCount: branches.filter((b) => b.branchType !== 'hq').length,
      },
    };
  }

  async getBranchProfile(branchId: string) {
    await this.ensureNetworkStructure();
    const branch = await this.branchModel.findById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');

    const [
      manager,
      staff,
      parent,
      children,
      activeOrders,
      currentLoadKg,
      metrics,
      quotaToday,
    ] = await Promise.all([
      branch.managerUserId
        ? this.userModel.findById(branch.managerUserId).select('email phone role')
        : null,
      this.userModel
        .find({ branchId: branch._id, role: UserRole.STAFF, isActive: true })
        .select('email phone'),
      branch.parentBranchId
        ? this.branchModel.findById(branch.parentBranchId).select('code name branchType')
        : null,
      this.branchModel
        .find({ parentBranchId: branch._id })
        .select('code name branchType city isActive'),
      this.branchesService.countActiveOrdersForBranch(branch._id),
      this.branchesService.sumBranchWeightLoadKg(branch._id),
      this.buildPerformanceMetrics(branch._id),
      this.getDailyQuotaUsage(branch._id, branch),
    ]);

    const partner = await this.userModel
      .findById(branch.partnerUserId)
      .select('email phone');

    const capacityKg = branch.maxWeightCapacityKg ?? 200;
    const utilizationWeightPercent =
      capacityKg > 0 ? Math.min(100, Math.round((currentLoadKg / capacityKg) * 100)) : 0;

    return {
      success: true,
      data: {
        branch: {
          id: branch._id.toString(),
          code: branch.code,
          name: branch.name,
          branchType: branch.branchType,
          branchTypeLabel: BRANCH_TYPE_LABELS[branch.branchType],
          line1: branch.line1,
          city: branch.city,
          province: branch.province,
          isActive: branch.isActive,
          parentBranchId: branch.parentBranchId?.toString(),
          partnerUserId: branch.partnerUserId.toString(),
          maxActiveOrders: branch.maxActiveOrders,
          maxWeightCapacityKg: capacityKg,
          dailyQuotaOrders: branch.dailyQuotaOrders ?? 30,
          dailyQuotaWeightKg: branch.dailyQuotaWeightKg ?? 250,
          serviceRadiusKm: branch.serviceRadiusKm,
          location: {
            longitude: branch.location.coordinates[0],
            latitude: branch.location.coordinates[1],
          },
        },
        hierarchy: {
          parent: parent
            ? {
                id: parent._id.toString(),
                code: parent.code,
                name: parent.name,
                branchType: parent.branchType,
              }
            : null,
          children: children.map((c) => ({
            id: c._id.toString(),
            code: c.code,
            name: c.name,
            branchType: c.branchType,
            city: c.city,
            isActive: c.isActive,
          })),
        },
        manager: manager
          ? {
              id: manager._id.toString(),
              email: manager.email,
              phone: manager.phone,
              role: manager.role,
            }
          : null,
        partner: partner
          ? {
              id: partner._id.toString(),
              email: partner.email,
              phone: partner.phone,
            }
          : null,
        staff: staff.map((s) => ({
          id: s._id.toString(),
          email: s.email,
          phone: s.phone,
        })),
        machines: branch.machines ?? [],
        capacity: {
          activeOrders,
          maxActiveOrders: branch.maxActiveOrders,
          ordersCapacityAvailable: activeOrders < branch.maxActiveOrders,
          currentLoadKg,
          maxWeightCapacityKg: capacityKg,
          utilizationWeightPercent,
          weightCapacityAvailable: currentLoadKg < capacityKg,
        },
        dailyQuota: quotaToday,
        performance: metrics,
      },
    };
  }

  async createBranch(dto: CreateBranchDto) {
    await this.ensureNetworkStructure();
    const parent = await this.branchModel.findById(dto.parentBranchId);
    if (!parent) throw new NotFoundException('Parent branch not found');

    const existing = await this.branchModel.findOne({ code: dto.code });
    if (existing) throw new BadRequestException('Branch code already exists');

    const partner = await this.userModel.findById(dto.partnerUserId);
    if (!partner || partner.role !== UserRole.PARTNER) {
      throw new BadRequestException('Invalid partner user');
    }

    if (dto.managerUserId) {
      const manager = await this.userModel.findById(dto.managerUserId);
      if (!manager) throw new BadRequestException('Manager user not found');
    }

    const branch = await this.branchModel.create({
      code: dto.code,
      name: dto.name,
      branchType: dto.branchType,
      parentBranchId: parent._id,
      line1: dto.line1,
      city: dto.city,
      province: dto.province,
      partnerUserId: partner._id,
      managerUserId: dto.managerUserId
        ? new Types.ObjectId(dto.managerUserId)
        : partner._id,
      maxActiveOrders: dto.maxActiveOrders ?? 20,
      maxWeightCapacityKg: dto.maxWeightCapacityKg ?? 200,
      dailyQuotaOrders: dto.dailyQuotaOrders ?? 25,
      dailyQuotaWeightKg: dto.dailyQuotaWeightKg ?? 200,
      serviceRadiusKm: dto.serviceRadiusKm ?? 12,
      machines: DEFAULT_MACHINES,
      isActive: true,
      location: { type: 'Point', coordinates: dto.coordinates },
    });

    return {
      success: true,
      data: { branchId: branch._id.toString(), code: branch.code, name: branch.name },
    };
  }

  async updateBranch(branchId: string, dto: UpdateBranchDto) {
    const branch = await this.branchModel.findById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.branchType === 'hq' && dto.branchType && dto.branchType !== 'hq') {
      throw new BadRequestException('Cannot change Lunara HQ type');
    }

    if (dto.parentBranchId) {
      const parent = await this.branchModel.findById(dto.parentBranchId);
      if (!parent) throw new NotFoundException('Parent branch not found');
      if (parent._id.equals(branch._id)) {
        throw new BadRequestException('Branch cannot be its own parent');
      }
      branch.parentBranchId = parent._id;
    }

    if (dto.name !== undefined) branch.name = dto.name;
    if (dto.branchType !== undefined) branch.branchType = dto.branchType;
    if (dto.managerUserId !== undefined) {
      branch.managerUserId = new Types.ObjectId(dto.managerUserId);
    }
    if (dto.maxActiveOrders !== undefined) branch.maxActiveOrders = dto.maxActiveOrders;
    if (dto.maxWeightCapacityKg !== undefined) {
      branch.maxWeightCapacityKg = dto.maxWeightCapacityKg;
    }
    if (dto.dailyQuotaOrders !== undefined) branch.dailyQuotaOrders = dto.dailyQuotaOrders;
    if (dto.dailyQuotaWeightKg !== undefined) {
      branch.dailyQuotaWeightKg = dto.dailyQuotaWeightKg;
    }
    if (dto.serviceRadiusKm !== undefined) branch.serviceRadiusKm = dto.serviceRadiusKm;
    if (dto.isActive !== undefined) branch.isActive = dto.isActive;
    if (dto.machines !== undefined) branch.machines = dto.machines;

    await branch.save();
    return this.getBranchProfile(branchId);
  }

  private async buildPerformanceMetrics(
    branchId: Types.ObjectId,
  ): Promise<BranchPerformanceMetrics> {
    const perf = await this.branchesService.getBranchPerformance(branchId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [ordersToday, revenueAgg, loadKg] = await Promise.all([
      this.orderModel.countDocuments({ branchId, createdAt: { $gte: startOfDay } }),
      this.orderModel.aggregate([
        {
          $match: {
            branchId,
            status: { $in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
            updatedAt: { $gte: startOfDay },
          },
        },
        { $group: { _id: null, revenue: { $sum: '$total' } } },
      ]),
      this.branchesService.sumBranchWeightLoadKg(branchId),
    ]);

    const branch = await this.branchModel.findById(branchId);
    const capacityKg = branch?.maxWeightCapacityKg ?? 200;
    const utilizationWeightPercent =
      capacityKg > 0 ? Math.min(100, Math.round((loadKg / capacityKg) * 100)) : 0;

    return {
      completedOrders30d: perf.completedOrders30d,
      onTimeRatePercent: perf.onTimeRatePercent,
      performanceScore: perf.score,
      performanceLabel: perf.label,
      ordersToday,
      revenueToday: revenueAgg[0]?.revenue ?? 0,
      utilizationWeightPercent,
    };
  }

  private async getDailyQuotaUsage(branchId: Types.ObjectId, branch: BranchDocument) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [ordersToday, weightRows] = await Promise.all([
      this.orderModel.countDocuments({ branchId, createdAt: { $gte: startOfDay } }),
      this.orderModel.aggregate([
        { $match: { branchId, createdAt: { $gte: startOfDay } } },
        {
          $group: {
            _id: null,
            kg: {
              $sum: {
                $ifNull: ['$estimatedWeightKg', 5],
              },
            },
          },
        },
      ]),
    ]);

    const weightToday = Math.round((weightRows[0]?.kg ?? 0) * 10) / 10;
    const quotaOrders = branch.dailyQuotaOrders ?? 30;
    const quotaWeight = branch.dailyQuotaWeightKg ?? 250;

    return {
      ordersToday,
      quotaOrders,
      ordersQuotaPercent:
        quotaOrders > 0 ? Math.min(100, Math.round((ordersToday / quotaOrders) * 100)) : 0,
      weightTodayKg: weightToday,
      quotaWeightKg: quotaWeight,
      weightQuotaPercent:
        quotaWeight > 0 ? Math.min(100, Math.round((weightToday / quotaWeight) * 100)) : 0,
    };
  }

  private async serializeTreeNode(
    branch: BranchDocument,
    all: BranchDocument[],
  ): Promise<BranchTreeNode> {
    const childBranches = all.filter(
      (b) => b.parentBranchId?.toString() === branch._id.toString(),
    );
    return {
      id: branch._id.toString(),
      code: branch.code,
      name: branch.name,
      branchType: branch.branchType,
      branchTypeLabel: BRANCH_TYPE_LABELS[branch.branchType],
      parentBranchId: branch.parentBranchId?.toString(),
      isActive: branch.isActive,
      city: branch.city,
      childCount: childBranches.length,
      children: [],
    };
  }

  private async seedOperationalBranches(
    partnerId: Types.ObjectId,
    hqId: Types.ObjectId,
  ) {
    const seeds = [
      {
        code: 'MKT-01',
        name: 'Lunara Makati',
        line1: '123 Ayala Ave',
        city: 'Makati',
        province: 'Metro Manila',
        coordinates: [121.0244, 14.5547] as [number, number],
        maxActiveOrders: 25,
        maxWeightCapacityKg: 200,
        serviceRadiusKm: 12,
      },
      {
        code: 'QC-01',
        name: 'Lunara Quezon City',
        line1: '45 Timog Ave',
        city: 'Quezon City',
        province: 'Metro Manila',
        coordinates: [121.0437, 14.676] as [number, number],
        maxActiveOrders: 20,
        maxWeightCapacityKg: 200,
        serviceRadiusKm: 14,
      },
      {
        code: 'BGC-01',
        name: 'Lunara BGC',
        line1: '8th Ave cor 28th St',
        city: 'Taguig',
        province: 'Metro Manila',
        coordinates: [121.0509, 14.5176] as [number, number],
        maxActiveOrders: 18,
        maxWeightCapacityKg: 300,
        serviceRadiusKm: 10,
      },
    ];

    for (const b of seeds) {
      await this.branchModel.create({
        code: b.code,
        name: b.name,
        branchType: 'partner_shop',
        parentBranchId: hqId,
        line1: b.line1,
        city: b.city,
        province: b.province,
        partnerUserId: partnerId,
        managerUserId: partnerId,
        maxActiveOrders: b.maxActiveOrders,
        maxWeightCapacityKg: b.maxWeightCapacityKg,
        dailyQuotaOrders: b.maxActiveOrders,
        dailyQuotaWeightKg: b.maxWeightCapacityKg,
        serviceRadiusKm: b.serviceRadiusKm,
        machines: DEFAULT_MACHINES,
        isActive: true,
        location: { type: 'Point', coordinates: b.coordinates },
      });
    }
  }

  private countDescendants(node: BranchTreeNode): number {
    let n = node.children.length;
    for (const c of node.children) {
      n += this.countDescendants(c);
    }
    return n;
  }
}
