import { Injectable } from '@nestjs/common';
import { OrdersService } from '../../orders/orders.service';
import { RidersService } from '../../riders/riders.service';
import { LedgerService } from '../../ledger/ledger.service';
import { WalletsService } from '../../wallets/wallets.service';
import { RefundsService } from '../../refunds/refunds.service';
import { AdminService } from '../../admin/admin.service';
import { AdminDispatchService } from '../../admin/admin-dispatch.service';
import { AdminOperationsService } from '../../admin/admin-operations.service';
import { BranchesService } from '../../branches/branches.service';
import { BranchManagementService } from '../../branches/branch-management.service';
import { RiderSosService } from '../../sos/rider-sos.service';
import { ServiceAreasService } from '../../service-areas/service-areas.service';
import { PartnerApplicationsService } from '../../partner-applications/partner-applications.service';
import { RiderApplicationsService } from '../../rider-applications/rider-applications.service';
import { PartnersService } from '../../partners/partners.service';
import { IncentiveCampaignsService } from '../../incentive-campaigns/incentive-campaigns.service';
import { BannersService } from '../../banners/banners.service';
import { PushNotificationService } from '../../push/push-notification.service';
import { SettingsService } from '../../settings/settings.service';
import { CustomersService } from '../../customers/customers.service';
import { AddressesService } from '../../addresses/addresses.service';
import { FavoritesService } from '../../favorites/favorites.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { PromotionsService } from '../../promotions/promotions.service';
import { RewardsService } from '../../rewards/rewards.service';
import { ReviewsService } from '../../reviews/reviews.service';
import { SupportService } from '../../support/support.service';
import { BookingService } from '../../booking/booking.service';
import { ApiSurfaceService } from './api-surface.service';
import { buildOrderTools } from './orders.tools';
import { buildRiderTools } from './riders.tools';
import { buildLedgerTools } from './ledger.tools';
import { buildWalletTools } from './wallets.tools';
import { buildRefundTools } from './refunds.tools';
import { buildAdminTools } from './admin.tools';
import { buildAdminOperationsTools } from './admin-operations.tools';
import { buildBranchTools } from './branches.tools';
import { buildDispatchTools } from './dispatch.tools';
import { buildSosTools } from './sos.tools';
import { buildServiceAreaTools } from './service-areas.tools';
import { buildPartnerApplicationTools } from './partner-applications.tools';
import { buildRiderApplicationTools } from './rider-applications.tools';
import { buildPartnerTools } from './partners.tools';
import { buildIncentiveCampaignTools } from './incentive-campaigns.tools';
import { buildBannerTools } from './banners.tools';
import { buildBroadcastTools } from './broadcast.tools';
import { buildSettingsTools } from './settings.tools';
import { buildCustomerTools } from './customers.tools';
import { buildAddressTools } from './addresses.tools';
import { buildFavoriteTools } from './favorites.tools';
import { buildSubscriptionTools } from './subscriptions.tools';
import { buildDealTools } from './deals.tools';
import { buildRewardTools } from './rewards.tools';
import { buildNotificationTools } from './notifications.tools';
import { buildSupportTools } from './support.tools';
import { buildBookingTools } from './booking.tools';
import { buildApiSurfaceTools } from './api-surface.tools';
import { buildGuestTools } from './guest.tools';
import { ToolCtx, ToolSpec } from './types';

@Injectable()
export class AiToolRegistry {
  private readonly specs: ToolSpec[];

  constructor(
    orders: OrdersService,
    riders: RidersService,
    ledger: LedgerService,
    wallets: WalletsService,
    refunds: RefundsService,
    admin: AdminService,
    dispatch: AdminDispatchService,
    adminOperations: AdminOperationsService,
    branches: BranchesService,
    branchManagement: BranchManagementService,
    sos: RiderSosService,
    serviceAreas: ServiceAreasService,
    partnerApplications: PartnerApplicationsService,
    riderApplications: RiderApplicationsService,
    partners: PartnersService,
    incentiveCampaigns: IncentiveCampaignsService,
    banners: BannersService,
    push: PushNotificationService,
    settings: SettingsService,
    customers: CustomersService,
    addresses: AddressesService,
    favorites: FavoritesService,
    subscriptions: SubscriptionsService,
    promotions: PromotionsService,
    rewards: RewardsService,
    reviews: ReviewsService,
    support: SupportService,
    booking: BookingService,
    apiSurface: ApiSurfaceService,
  ) {
    this.specs = [
      ...buildOrderTools(orders),
      ...buildRiderTools(riders),
      ...buildLedgerTools(ledger),
      ...buildWalletTools(wallets),
      ...buildRefundTools(refunds),
      ...buildAdminTools(admin),
      ...buildAdminOperationsTools(adminOperations),
      ...buildBranchTools(branches, branchManagement),
      ...buildDispatchTools(dispatch),
      ...buildSosTools(sos),
      ...buildServiceAreaTools(serviceAreas),
      ...buildPartnerApplicationTools(partnerApplications),
      ...buildRiderApplicationTools(riderApplications),
      ...buildPartnerTools(partners),
      ...buildIncentiveCampaignTools(incentiveCampaigns),
      ...buildBannerTools(banners),
      ...buildBroadcastTools(push),
      ...buildSettingsTools(settings),
      ...buildCustomerTools(customers),
      ...buildAddressTools(addresses),
      ...buildFavoriteTools(favorites),
      ...buildSubscriptionTools(subscriptions),
      ...buildDealTools(promotions),
      ...buildRewardTools(rewards),
      ...buildNotificationTools(reviews),
      ...buildSupportTools(support),
      ...buildBookingTools(booking),
      ...buildApiSurfaceTools(apiSurface),
      ...buildGuestTools(branches),
    ];
  }

  getToolsForPersona(personaId: string) {
    return this.specs
      .filter((s) => s.personas.includes(personaId))
      .map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  }

  /** Only tools explicitly marked `guestSafe` — the sole tools an unauthenticated caller can reach. */
  getGuestToolsForPersona(personaId: string) {
    return this.specs
      .filter((s) => s.guestSafe && s.personas.includes(personaId))
      .map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  }

  async execute(name: string, input: unknown, ctx: ToolCtx): Promise<unknown> {
    const spec = this.specs.find((s) => s.name === name);
    if (!spec || !spec.personas.includes(ctx.personaId)) {
      throw new Error(`Tool "${name}" is not available to this agent`);
    }
    if (ctx.audience === 'guest' && !spec.guestSafe) {
      throw new Error(`Tool "${name}" is not available to guests`);
    }
    return spec.handler(input, ctx);
  }
}
