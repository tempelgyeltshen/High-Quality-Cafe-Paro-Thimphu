import React, { useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { OrderRound } from '../types/index.ts';

export interface AlertOrderNotification {
  id: string;
  order: OrderRound;
  receivedAt: number;
}

interface KitchenOrderAlertProps {
  notifications: AlertOrderNotification[];
  onDismiss: (id: string) => void;
  onAcknowledge: (orderId: string) => Promise<void>;
  onFocusTicket: (orderId: string) => void;
}

export const KitchenOrderAlert: React.FC<KitchenOrderAlertProps> = ({
  notifications,
  onDismiss,
  onAcknowledge,
  onFocusTicket
}) => {
  const currentNotification = notifications[0] || null;

  useEffect(() => {
    if (!currentNotification) return;
    const timer = setTimeout(() => {
      onDismiss(currentNotification.id);
    }, 8000);
    return () => clearTimeout(timer);
  }, [currentNotification, onDismiss]);

  if (!currentNotification) return null;

  const { order } = currentNotification;
  const totalQuantity = order.items.reduce((sum, it) => sum + it.quantity, 0);
  const destinationLabel =
    order.tableId === 'TAKEAWAY'
      ? 'Counter Pickup'
      : order.tableNumber || order.tableId;

  return (
    <div
      role="region"
      aria-label="New Incoming Order"
      className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold uppercase tracking-wide">
          New Order
        </span>
        <span className="text-base font-extrabold text-stone-900 font-mono tabular-nums">
          {order.orderNumber}
        </span>
        <span className="text-sm font-medium text-stone-700">
          {destinationLabel} · <span className="tabular-nums font-semibold">{totalQuantity}</span>{' '}
          {totalQuantity === 1 ? 'dish' : 'dishes'}
        </span>
        {notifications.length > 1 && (
          <span className="text-xs font-semibold text-amber-900 tabular-nums">
            (+{notifications.length - 1} more)
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            onAcknowledge(order.id);
            onDismiss(currentNotification.id);
          }}
          className="min-h-[42px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer"
        >
          Start Preparing
        </button>

        <button
          type="button"
          onClick={() => {
            onFocusTicket(order.id);
            onDismiss(currentNotification.id);
          }}
          className="min-h-[42px] px-3.5 py-2 rounded-lg bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-xs sm:text-sm font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <span>View Order</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onDismiss(currentNotification.id)}
          className="min-h-[42px] min-w-[42px] rounded-lg text-stone-500 hover:text-stone-800 hover:bg-amber-100/60 flex items-center justify-center transition-colors cursor-pointer"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
