'use client';

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PartnerQueueOrder } from '@lunara/types';
import { LAUNDRY_PROCESSING_STEPS } from '@lunara/utils';
import { formatPeso } from '../lib/format-peso';
import { partnerFetch } from '../lib/partner-api';

interface ProcessingKanbanBoardProps {
  orders: PartnerQueueOrder[];
  onAcceptJob: (orderId: string, e: React.MouseEvent) => void;
  onReload: () => Promise<void> | void;
}

function OrderCard({
  order,
  onAcceptJob,
}: {
  order: PartnerQueueOrder;
  onAcceptJob: (orderId: string, e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order._id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 10,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card relative p-3 ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Explicit drag handle — keeping drag listeners off the Link avoids fighting dnd-kit's
          pointer handling for click-vs-drag detection on the same element. */}
      <button
        type="button"
        aria-label="Drag to move"
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 cursor-grab touch-none rounded p-1 text-muted hover:bg-surface-muted active:cursor-grabbing"
      >
        ⠿
      </button>
      <Link href={`/orders/${order._id}`} className="block pr-6 hover:text-primary">
        <p className="font-medium capitalize text-slate-900">
          {order.bookingType.replace(/_/g, ' ')}
        </p>
        <p className="mt-1 text-sm font-semibold text-primary">{formatPeso(order.total)}</p>
        <p className="mt-1 text-xs text-muted">
          {order.isAssigned ? 'Assigned' : 'Open — accept to start'}
        </p>
      </Link>
      {!order.isAssigned ? (
        <button
          type="button"
          className="btn-accent btn-sm mt-2 w-full"
          onClick={(e) => onAcceptJob(order._id, e)}
        >
          Accept job
        </button>
      ) : null}
    </div>
  );
}

function KanbanColumn({
  stepId,
  label,
  orders,
  onAcceptJob,
}: {
  stepId: string;
  label: string;
  orders: PartnerQueueOrder[];
  onAcceptJob: (orderId: string, e: React.MouseEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stepId });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-lg border ${
        isOver ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-surface-muted'
      }`}
    >
      <div className="border-b border-border/60 px-3 py-2">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-muted">{orders.length} order{orders.length === 1 ? '' : 's'}</p>
      </div>
      <div className="flex-1 space-y-2 p-2" style={{ minHeight: '4rem' }}>
        {orders.map((o) => (
          <OrderCard key={o._id} order={o} onAcceptJob={onAcceptJob} />
        ))}
      </div>
    </div>
  );
}

export function ProcessingKanbanBoard({ orders, onAcceptJob, onReload }: ProcessingKanbanBoardProps) {
  const [localOrders, setLocalOrders] = useState(orders);
  const [moveError, setMoveError] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Keep local optimistic state in sync whenever the parent's data reloads (new array reference).
  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  async function handleDragEnd(event: DragEndEvent) {
    const orderId = event.active.id as string;
    const targetStepId = event.over?.id as string | undefined;
    if (!targetStepId) return;

    const order = localOrders.find((o) => o._id === orderId);
    if (!order || order.currentStepId === targetStepId) return;

    const previous = localOrders;
    setLocalOrders((prev) =>
      prev.map((o) => (o._id === orderId ? { ...o, currentStepId: targetStepId } : o)),
    );
    setMoveError('');

    try {
      await partnerFetch(`/partner/orders/${orderId}/processing/move`, {
        method: 'POST',
        body: JSON.stringify({ targetStepId }),
      });
      await onReload();
    } catch (err) {
      setLocalOrders(previous);
      setMoveError(err instanceof Error ? err.message : 'Could not move order');
    }
  }

  return (
    <div>
      {moveError ? <div className="alert-error mb-3">{moveError}</div> : null}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2 pb-safe">
          {LAUNDRY_PROCESSING_STEPS.map((step) => (
            <KanbanColumn
              key={step.id}
              stepId={step.id}
              label={step.label}
              orders={localOrders.filter((o) => o.currentStepId === step.id)}
              onAcceptJob={onAcceptJob}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
