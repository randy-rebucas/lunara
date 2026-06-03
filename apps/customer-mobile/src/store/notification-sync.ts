import { create } from 'zustand';

interface NotificationSyncStore {
  tick: number;
  bump: () => void;
}

export const useNotificationSyncStore = create<NotificationSyncStore>((set) => ({
  tick: 0,
  bump: () => set((state) => ({ tick: state.tick + 1 })),
}));
