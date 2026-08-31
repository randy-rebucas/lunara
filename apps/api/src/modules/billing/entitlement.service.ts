import { ForbiddenException, Injectable } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PlanService } from './plan.service';

export interface EntitlementsSnapshot {
  planKey: string;
  planName: string;
  status: string;
  limits: Record<string, number>;
  features: Record<string, boolean>;
}

const FALLBACK_LIMITS: Record<string, number> = {};
const FALLBACK_FEATURES: Record<string, boolean> = {};

@Injectable()
export class EntitlementService {
  constructor(
    private subscriptionService: SubscriptionService,
    private planService: PlanService,
  ) {}

  /** Partners with no Subscription doc yet (not migrated / no plan assigned) get an
   * empty-entitlement trial snapshot rather than throwing — callers should treat this
   * as "no paid features", not an error. */
  async getEntitlements(partnerId: string): Promise<EntitlementsSnapshot> {
    const subscription = await this.subscriptionService.findByPartnerId(partnerId);
    if (!subscription) {
      return { planKey: 'trial', planName: 'Trial', status: 'trialing', limits: FALLBACK_LIMITS, features: FALLBACK_FEATURES };
    }
    const plan = await this.planService.findById(subscription.planId);
    return {
      planKey: plan?.key ?? 'trial',
      planName: plan?.name ?? 'Trial',
      status: subscription.status,
      limits: plan?.limits ?? FALLBACK_LIMITS,
      features: plan?.features ?? FALLBACK_FEATURES,
    };
  }

  async can(partnerId: string, featureKey: string): Promise<boolean> {
    const { features } = await this.getEntitlements(partnerId);
    return features[featureKey] === true;
  }

  /** Caller supplies currentUsage (e.g. `await branchModel.countDocuments({ partnerUserId })`) —
   * no usage-metering pipeline exists yet, so this doesn't track usage itself. A missing limit
   * key means "unlimited" for that key. */
  async checkLimit(partnerId: string, limitKey: string, currentUsage: number): Promise<boolean> {
    const { limits } = await this.getEntitlements(partnerId);
    const max = limits[limitKey];
    if (max === undefined) return true;
    return currentUsage < max;
  }

  /** Blocks the two self-service write paths that matter most for a suspended partner — new
   * orders and new staff. Partners with no Subscription doc (not migrated) are never suspended
   * by this check, matching getEntitlements' "no record = trial" treatment. */
  async assertNotSuspended(partnerId: string): Promise<void> {
    const subscription = await this.subscriptionService.findByPartnerId(partnerId);
    if (subscription?.status === 'suspended') {
      throw new ForbiddenException(
        'This shop is suspended pending payment — new orders and staff cannot be added until the outstanding balance is settled.',
      );
    }
  }
}
