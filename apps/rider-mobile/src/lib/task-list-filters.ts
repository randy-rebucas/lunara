import { OrderStatus } from '@lunara/types';
import type {
  CancelledTaskItem,
  DeliveryOffer,
  PickupOffer,
  Task,
  TaskHistoryItem,
} from './rider-types';

export type TaskListFilter =
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export const TASK_LIST_FILTERS: { id: TaskListFilter; label: string }[] = [
  { id: 'assigned', label: 'Assigned' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const PICKUP_ACTIVE_STATUSES = new Set<string>([
  OrderStatus.RIDER_ASSIGNED_PICKUP,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT_TO_SHOP,
]);

export function isPickupTask(task: Task) {
  return task.leg === 'pickup' || PICKUP_ACTIVE_STATUSES.has(task.status);
}

export function classifyTask(task: Task): TaskListFilter {
  if (task.status === OrderStatus.CANCELLED) return 'cancelled';

  if (isPickupTask(task)) {
    const p = task.pickup;
    if (!p?.acceptedAt) return 'assigned';
    if (!p.arrivedAt && !p.collectedAt && !p.droppedAtShop) return 'accepted';
    return 'in_progress';
  }

  const d = task.delivery;
  if (task.status === OrderStatus.RIDER_ASSIGNED_DELIVERY && !d?.acceptedAt) {
    return 'assigned';
  }
  if (
    d?.acceptedAt &&
    !d.pickedUpFromShopAt &&
    task.status !== OrderStatus.OUT_FOR_DELIVERY
  ) {
    return 'accepted';
  }
  return 'in_progress';
}

export type TaskListRow =
  | { kind: 'pickup_offer'; item: PickupOffer }
  | { kind: 'delivery_offer'; item: DeliveryOffer }
  | { kind: 'task'; item: Task }
  | { kind: 'history'; item: TaskHistoryItem }
  | { kind: 'cancelled'; item: CancelledTaskItem };

export function buildTaskListRows(
  filter: TaskListFilter,
  offers: PickupOffer[],
  deliveryOffers: DeliveryOffer[],
  tasks: Task[],
  history: TaskHistoryItem[],
  cancelled: CancelledTaskItem[],
): TaskListRow[] {
  switch (filter) {
    case 'assigned':
      return [
        ...offers.map((item) => ({ kind: 'pickup_offer' as const, item })),
        ...deliveryOffers.map((item) => ({ kind: 'delivery_offer' as const, item })),
        ...tasks
          .filter((task) => classifyTask(task) === 'assigned')
          .map((item) => ({ kind: 'task' as const, item })),
      ];
    case 'accepted':
      return tasks
        .filter((task) => classifyTask(task) === 'accepted')
        .map((item) => ({ kind: 'task' as const, item }));
    case 'in_progress':
      return tasks
        .filter((task) => classifyTask(task) === 'in_progress')
        .map((item) => ({ kind: 'task' as const, item }));
    case 'completed':
      return history.map((item) => ({ kind: 'history' as const, item }));
    case 'cancelled':
      return cancelled.map((item) => ({ kind: 'cancelled' as const, item }));
    default:
      return [];
  }
}

export function taskListEmptyMessage(filter: TaskListFilter, online: boolean) {
  if (!online && filter !== 'completed' && filter !== 'cancelled') {
    return 'Go online from Home to receive assignments and active tasks.';
  }

  switch (filter) {
    case 'assigned':
      return 'No assigned tasks — pickup offers and delivery assignments will appear here.';
    case 'accepted':
      return 'No accepted tasks waiting to start.';
    case 'in_progress':
      return 'No tasks in progress — accept a job to begin a route.';
    case 'completed':
      return 'No completed tasks yet — finish a route to see it here.';
    case 'cancelled':
      return 'No cancelled tasks on your record.';
    default:
      return 'No tasks found.';
  }
}
