'use client';

export interface OrderNotification {
  id: string;
  message: string;
  at: string;
}

export function OrderNotifications({
  notifications,
  live,
}: {
  notifications: OrderNotification[];
  live?: boolean;
}) {
  if (notifications.length === 0) return null;

  return (
    <div className="panel bg-cyan-50/80 ring-1 ring-secondary/15">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">Notifications</p>
        {live && (
          <span className="flex items-center gap-1 text-xs text-accent">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            Live
          </span>
        )}
      </div>
      <ul className="mt-3 list-stack-sm max-h-40 overflow-y-auto">
        {notifications.map((n) => (
          <li key={n.id} className="text-sm text-slate-700">
            <span className="text-slate-400">{n.at}</span> — {n.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
