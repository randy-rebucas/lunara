'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { OrderStatus } from '@lunara/types';
import { Button } from '@lunara/ui';
import { formatCurrency } from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { Card, CardBody } from './ui/card';

type CreateMode = 'general' | 'lost_item' | 'area';

interface OrderOption {
  _id: string;
  status: string;
  total: number;
  createdAt?: string;
}

interface AddressOption {
  _id: string;
  label: string;
  line1: string;
  city: string;
  province: string;
  postalCode: string;
}

const MODE_OPTIONS: { id: CreateMode; label: string; hint: string }[] = [
  {
    id: 'general',
    label: 'General question',
    hint: 'Billing, order status, or anything else',
  },
  {
    id: 'lost_item',
    label: 'Missing item',
    hint: 'After your order is delivered',
  },
  {
    id: 'area',
    label: 'Pickup area',
    hint: 'Request service in your neighborhood',
  },
];

const LOST_ITEM_ELIGIBLE = new Set<string>([
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
]);

interface SupportCreateSectionProps {
  onTicketCreated?: () => void;
}

export function SupportCreateSection({ onTicketCreated }: SupportCreateSectionProps) {
  const { api } = useAuthContext();
  const router = useRouter();
  const [mode, setMode] = useState<CreateMode>('general');

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [relatedOrderId, setRelatedOrderId] = useState('');
  const [generalSubmitting, setGeneralSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');

  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [areaMessage, setAreaMessage] = useState('');
  const [areaSubmitting, setAreaSubmitting] = useState(false);
  const [areaError, setAreaError] = useState('');
  const [areaSuccess, setAreaSuccess] = useState('');

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const res = await api.get<{ items: OrderOption[] }>('/orders?page=1&limit=30');
      setOrders(res.data.items);
    } catch (e) {
      setOrdersError(e instanceof Error ? e.message : 'Could not load orders');
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [api]);

  const loadAddresses = useCallback(async () => {
    setAddressesLoading(true);
    try {
      const res = await api.get<AddressOption[]>('/addresses');
      setAddresses(res.data);
      setSelectedAddressId((prev) => prev || res.data[0]?._id || '');
    } catch {
      setAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  }, [api]);

  useEffect(() => {
    const needsOrders = mode === 'lost_item' || mode === 'general';
    if (needsOrders && orders.length === 0 && !ordersLoading && !ordersError) {
      void loadOrders();
    }
  }, [mode, orders.length, ordersLoading, ordersError, loadOrders]);

  useEffect(() => {
    if (mode === 'area' && addresses.length === 0 && !addressesLoading) {
      void loadAddresses();
    }
  }, [mode, addresses.length, addressesLoading, loadAddresses]);

  async function submitGeneral() {
    setGeneralSubmitting(true);
    setGeneralError('');
    try {
      const res = await api.post<{ _id: string }>('/support/tickets', {
        subject: subject.trim(),
        description: description.trim(),
        orderId: relatedOrderId || undefined,
      });
      onTicketCreated?.();
      router.push(`/support/${res.data._id}`);
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : 'Could not submit ticket');
    } finally {
      setGeneralSubmitting(false);
    }
  }

  async function submitAreaRequest() {
    if (!selectedAddressId) {
      setAreaError('Choose an address first');
      return;
    }
    setAreaSubmitting(true);
    setAreaError('');
    setAreaSuccess('');
    try {
      await api.post('/support/area-requests', {
        addressId: selectedAddressId,
        message: areaMessage.trim() || undefined,
      });
      setAreaMessage('');
      setAreaSuccess('Request sent. Our team will review pickup for your area.');
      onTicketCreated?.();
    } catch (e) {
      setAreaError(e instanceof Error ? e.message : 'Could not send request');
    } finally {
      setAreaSubmitting(false);
    }
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Create a ticket</h2>
          <p className="mt-1 text-sm text-muted">
            Choose how you want to reach support. Each option opens a tracked ticket you can follow
            below.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              className={`rounded-lg p-3 text-left ring-1 transition-shadow ${
                mode === opt.id
                  ? 'selectable-item-active ring-2'
                  : 'selectable-item hover:shadow-[var(--shadow-elevated)]'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
              <p className="mt-0.5 text-xs text-muted">{opt.hint}</p>
            </button>
          ))}
        </div>

        {mode === 'general' && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <label className="block text-sm font-medium text-slate-700">
              Subject
              <input
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Question about my last order"
                maxLength={120}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Details
              <textarea
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your issue so we can help (at least 10 characters)."
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Related order (optional)
              <select
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                value={relatedOrderId}
                onChange={(e) => setRelatedOrderId(e.target.value)}
              >
                <option value="">None</option>
                {orders.map((o) => (
                  <option key={o._id} value={o._id}>
                    …{o._id.slice(-6)} · {o.status.replace(/_/g, ' ')} ·{' '}
                    {formatCurrency(o.total)}
                  </option>
                ))}
              </select>
            </label>
            {generalError && <p className="text-sm text-red-600">{generalError}</p>}
            <Button
              type="button"
              disabled={
                generalSubmitting || subject.trim().length < 3 || description.trim().length < 10
              }
              onClick={() => void submitGeneral()}
            >
              {generalSubmitting ? 'Submitting…' : 'Submit ticket'}
            </Button>
          </div>
        )}

        {mode === 'lost_item' && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <p className="text-sm text-muted">
              Missing items are reported per delivered order. We start an investigation and keep you
              updated on this page.
            </p>
            {ordersLoading && <p className="text-sm text-muted">Loading eligible orders…</p>}
            {ordersError && <p className="text-sm text-red-600">{ordersError}</p>}
            {!ordersLoading && !ordersError && orders.filter((o) => LOST_ITEM_ELIGIBLE.has(o.status)).length === 0 && (
              <p className="text-sm text-muted">
                No delivered orders yet. After delivery, use{' '}
                <Link href="/orders" className="link-primary">
                  My orders
                </Link>{' '}
                and open an order to report a missing item.
              </p>
            )}
            <ul className="space-y-2">
              {orders.filter((o) => LOST_ITEM_ELIGIBLE.has(o.status)).map((o) => (
                <li key={o._id}>
                  <Link
                    href={`/orders/${o._id}/lost-item`}
                    className="flex items-center justify-between rounded-lg bg-surface-muted px-4 py-3 text-sm ring-1 ring-border/50 transition-shadow hover:shadow-[var(--shadow-elevated)]"
                  >
                    <span>
                      Order …{o._id.slice(-6)}
                      <span className="ml-2 capitalize text-muted">
                        {o.status.replace(/_/g, ' ')}
                      </span>
                    </span>
                    <span className="font-medium text-primary">Report →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {mode === 'area' && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <p className="text-sm text-muted">
              If pickup is not available at your address, submit a coverage request. You can also
              trigger this while booking when no slots appear.
            </p>
            {addressesLoading && <p className="text-sm text-muted">Loading addresses…</p>}
            {!addressesLoading && addresses.length === 0 && (
              <p className="text-sm text-muted">
                Add a saved address on{' '}
                <Link href="/profile" className="link-primary">
                  Profile
                </Link>{' '}
                first, then return here to request coverage.
              </p>
            )}
            {addresses.length > 0 && (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  Address
                  <select
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                    value={selectedAddressId}
                    onChange={(e) => setSelectedAddressId(e.target.value)}
                  >
                    {addresses.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.label} — {a.line1}, {a.city}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Note (optional)
                  <textarea
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                    rows={3}
                    value={areaMessage}
                    onChange={(e) => setAreaMessage(e.target.value)}
                    placeholder="Preferred pickup times, building access, etc."
                  />
                </label>
                {areaError && <p className="text-sm text-red-600">{areaError}</p>}
                {areaSuccess && <p className="text-sm font-medium text-emerald-700">{areaSuccess}</p>}
                <Button
                  type="button"
                  disabled={areaSubmitting || !selectedAddressId}
                  onClick={() => void submitAreaRequest()}
                >
                  {areaSubmitting ? 'Sending…' : 'Request pickup area'}
                </Button>
              </>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
