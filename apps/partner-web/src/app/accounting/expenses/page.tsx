'use client';

import { useEffect, useState } from 'react';
import { AuthLoading } from '../../../components/auth-loading';
import { DataPageStatus } from '../../../components/data-page-status';
import { StatCard } from '../../../components/ui/card';
import { PageHeader } from '../../../components/ui/page-header';
import { RightDrawer } from '../../../components/ui/right-drawer';
import { useRequirePartner } from '../../../hooks/use-protected-page';
import { formatPeso } from '../../../lib/format-peso';
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
  type PartnerExpense,
} from '../../../lib/partner-api';

const CATEGORY_SUGGESTIONS = ['Supplies', 'Utilities', 'Rent', 'Maintenance', 'Payroll', 'Marketing', 'Other'];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = { category: '', amount: '', date: todayIso(), note: '' };

export default function AccountingExpensesPage() {
  const { ready } = useRequirePartner();

  const [expenses, setExpenses] = useState<PartnerExpense[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rowError, setRowError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<PartnerExpense | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadExpenses() {
    setLoading(true);
    setError('');
    try {
      setExpenses(await listExpenses());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready) void loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function openCreateForm() {
    setEditingExpense(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(expense: PartnerExpense) {
    setEditingExpense(expense);
    setForm({
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date.slice(0, 10),
      note: expense.note ?? '',
    });
    setShowForm(true);
  }

  async function saveExpense() {
    setRowError('');
    setSaving(true);
    try {
      const input = {
        category: form.category.trim(),
        amount: Number(form.amount),
        date: form.date,
        note: form.note.trim() || undefined,
      };
      if (editingExpense) {
        await updateExpense(editingExpense._id, input);
      } else {
        await createExpense(input);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingExpense(null);
      await loadExpenses();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense(expense: PartnerExpense) {
    if (!window.confirm(`Delete this ${expense.category} expense of ${formatPeso(expense.amount, true)}?`)) return;
    setRowError('');
    setBusyId(expense._id);
    try {
      await deleteExpense(expense._id);
      await loadExpenses();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : 'Failed to delete expense');
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return <AuthLoading message="Loading expenses…" />;

  const formValid = form.category.trim() && Number(form.amount) > 0 && form.date;

  const list = expenses ?? [];
  const now = new Date();
  const totalThisMonth = list
    .filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, e) => s + e.amount, 0);
  const totalAllTime = list.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track shop expenses — supplies, utilities, and other operating costs."
        actions={
          <button type="button" className="btn-primary btn-sm" onClick={openCreateForm}>
            Add expense
          </button>
        }
      />

      <div className="mt-4">
        <DataPageStatus loading={loading} error={error} loadingMessage="Loading expenses…" onRetry={loadExpenses} />
      </div>

      {rowError && (
        <div className="alert-error mt-3 flex flex-wrap items-center justify-between gap-3">
          <span>{rowError}</span>
          <button
            type="button"
            onClick={() => setRowError('')}
            className="shrink-0 text-sm font-medium underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">No expenses recorded yet.</p>
        </div>
      )}

      {list.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="This month" value={formatPeso(totalThisMonth, true)} />
            <StatCard label="All time" value={formatPeso(totalAllTime, true)} accent="secondary" />
          </div>

          <div className="section-panel mt-4 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Note</th>
                    <th>Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e._id}>
                      <td className="text-muted">{new Date(e.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td>
                        <span className="badge-neutral text-xs">{e.category}</span>
                      </td>
                      <td className="text-muted">{e.note || '—'}</td>
                      <td className="font-medium text-slate-900">{formatPeso(e.amount, true)}</td>
                      <td>
                        <div className="flex gap-2">
                          <button type="button" className="btn-outline btn-sm" onClick={() => openEditForm(e)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-outline btn-sm"
                            disabled={busyId === e._id}
                            onClick={() => void removeExpense(e)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <RightDrawer
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingExpense ? 'Edit expense' : 'Add expense'}
      >
        <div className="grid gap-3">
          <div>
            <label className="form-label">Category</label>
            <input
              className="input-field"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. Supplies"
              list="expense-category-suggestions"
            />
            <datalist id="expense-category-suggestions">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="form-label">Amount (₱)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input-field"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Date</label>
            <input
              type="date"
              className="input-field"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Note (optional)</label>
            <input
              className="input-field"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. Detergent restock"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            className="btn-primary btn-sm w-full"
            disabled={saving || !formValid}
            onClick={() => void saveExpense()}
          >
            {saving ? 'Saving…' : editingExpense ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </RightDrawer>
    </div>
  );
}
