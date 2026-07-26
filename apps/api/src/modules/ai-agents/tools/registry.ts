import { Injectable } from '@nestjs/common';
import { OrdersService } from '../../orders/orders.service';
import { RidersService } from '../../riders/riders.service';
import { LedgerService } from '../../ledger/ledger.service';
import { WalletsService } from '../../wallets/wallets.service';
import { RefundsService } from '../../refunds/refunds.service';
import { AdminService } from '../../admin/admin.service';
import { AdminDispatchService } from '../../admin/admin-dispatch.service';
import { RiderSosService } from '../../sos/rider-sos.service';
import { ServiceAreasService } from '../../service-areas/service-areas.service';
import { PartnerApplicationsService } from '../../partner-applications/partner-applications.service';
import { RiderApplicationsService } from '../../rider-applications/rider-applications.service';
import { PartnersService } from '../../partners/partners.service';
import { IncentiveCampaignsService } from '../../incentive-campaigns/incentive-campaigns.service';
import { BannersService } from '../../banners/banners.service';
import { PushNotificationService } from '../../push/push-notification.service';
import { SettingsService } from '../../settings/settings.service';
import { buildOrderTools } from './orders.tools';
import { buildRiderTools } from './riders.tools';
import { buildLedgerTools } from './ledger.tools';
import { buildWalletTools } from './wallets.tools';
import { buildRefundTools } from './refunds.tools';
import { buildAdminTools } from './admin.tools';
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
    sos: RiderSosService,
    serviceAreas: ServiceAreasService,
    partnerApplications: PartnerApplicationsService,
    riderApplications: RiderApplicationsService,
    partners: PartnersService,
    incentiveCampaigns: IncentiveCampaignsService,
    banners: BannersService,
    push: PushNotificationService,
    settings: SettingsService,
  ) {
    this.specs = [
      ...buildOrderTools(orders),
      ...buildRiderTools(riders),
      ...buildLedgerTools(ledger),
      ...buildWalletTools(wallets),
      ...buildRefundTools(refunds),
      ...buildAdminTools(admin),
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
    ];
  }

  getToolsForPersona(personaId: string) {
    return this.specs
      .filter((s) => s.personas.includes(personaId))
      .map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  }

  async execute(name: string, input: unknown, ctx: ToolCtx): Promise<unknown> {
    const spec = this.specs.find((s) => s.name === name);
    if (!spec || !spec.personas.includes(ctx.personaId)) {
      throw new Error(`Tool "${name}" is not available to this agent`);
    }
    return spec.handler(input, ctx);
  }
}
