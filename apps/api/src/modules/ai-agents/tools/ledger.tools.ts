import { LedgerService } from '../../ledger/ledger.service';
import { ToolSpec } from './types';

export function buildLedgerTools(ledger: LedgerService): ToolSpec[] {
  return [
    {
      name: 'get_trial_balance',
      description: 'Get the current ledger trial balance: net balance per account type/subject.',
      input_schema: { type: 'object', properties: {} },
      personas: ['benjamin'],
      handler: async () => ledger.getTrialBalance(),
    },
    {
      name: 'get_reconciliation',
      description:
        'Get the full revenue reconciliation snapshot: P&L summary, cash flow, settlements, rider withdrawals, wallet totals, and spot-check drifts.',
      input_schema: { type: 'object', properties: {} },
      personas: ['benjamin'],
      handler: async () => ledger.getReconciliation(),
    },
    {
      name: 'get_accounting_overview',
      description: 'Get a monthly P&L trend, current-month cash flow, and the most recent posted ledger entries.',
      input_schema: {
        type: 'object',
        properties: {
          months: { type: 'number', description: 'How many months of trend to include (default 6).' },
          recentLimit: { type: 'number', description: 'How many recent entries to include (default 20).' },
        },
      },
      personas: ['benjamin'],
      handler: async (input: { months?: number; recentLimit?: number }) =>
        ledger.getAccountingOverview(input?.months, input?.recentLimit),
    },
    {
      name: 'get_reconciliation_transactions',
      description:
        'Get a per-transaction reconciliation list (payments, payouts, refunds) checked against whether each actually posted to the ledger.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of transactions to check (default 300).' },
        },
      },
      personas: ['benjamin'],
      handler: async (input: { limit?: number }) => ledger.getReconciliationTransactions(input?.limit),
    },
  ];
}
