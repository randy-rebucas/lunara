import type { PartnerInvoice } from '@lunara/types';
import type { PartnerExpense } from './partner-api';

/**
 * Shared invoice/expense aggregation for the accounting pages (accounts, income, profit-loss).
 * All-time revenue and fees here are derived from PartnerInvoice records — not from
 * /partner/revenue's order-based allTimeRevenue, which also counts orders completed in the
 * current not-yet-invoiced period and would otherwise make "net income" drift between pages
 * depending on which source a given screen happened to read from.
 */
export interface InvoiceExpenseTotals {
  totalCollected: number;
  totalFeesBilled: number;
  totalExpenses: number;
  netIncome: number;
}

export function sumInvoices(invoices: PartnerInvoice[]) {
  return invoices.reduce(
    (acc, inv) => ({
      totalCollected: acc.totalCollected + inv.totalCollected,
      totalFeesBilled: acc.totalFeesBilled + inv.amountDue,
    }),
    { totalCollected: 0, totalFeesBilled: 0 },
  );
}

export function sumExpenses(expenses: PartnerExpense[]) {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function computeTotals(invoices: PartnerInvoice[], expenses: PartnerExpense[]): InvoiceExpenseTotals {
  const { totalCollected, totalFeesBilled } = sumInvoices(invoices);
  const totalExpenses = sumExpenses(expenses);
  return {
    totalCollected,
    totalFeesBilled,
    totalExpenses,
    netIncome: totalCollected - totalFeesBilled - totalExpenses,
  };
}

/** Net income for a single invoice period, before operating expenses (those aren't tied to a
 * billing period). Used by the income page's per-row breakdown. */
export function invoiceNetIncome(inv: PartnerInvoice) {
  return inv.totalCollected - inv.amountDue;
}
