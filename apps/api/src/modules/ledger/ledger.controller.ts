import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@lunara/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LedgerService } from './ledger.service';

@Controller('admin/ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  /** Net balance per account, for cross-checking against PartnerSettlement/RiderWithdrawal totals. */
  @Get('trial-balance')
  async getTrialBalance() {
    const rows = await this.ledgerService.getTrialBalance();
    return { success: true, data: rows };
  }

  /** Full reconciliation: P&L summary, cash flow, settlement & withdrawal cross-checks, wallet drift. */
  @Get('reconciliation')
  async getReconciliation() {
    const data = await this.ledgerService.getReconciliation();
    return { success: true, data };
  }
}
