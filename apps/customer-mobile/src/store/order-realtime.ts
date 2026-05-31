import { create } from 'zustand';

export interface OrderRealtimeUpdate {
  orderId: string;
  status?: string;
  event?: string;
  message?: string;
  at: string;
}

interface OrderRealtimeStore {
  tick: number;
  lastUpdate: OrderRealtimeUpdate | null;
  notify: (update: Omit<OrderRealtimeUpdate, 'at'>) => void;
}

export const useOrderRealtimeStore = create<OrderRealtimeStore>((set) => ({
  tick: 0,
  lastUpdate: null,
  notify: (update) =>
    set((state) => ({
      tick: state.tick + 1,
      lastUpdate: { ...update, at: new Date().toISOString() },
    })),
}));
