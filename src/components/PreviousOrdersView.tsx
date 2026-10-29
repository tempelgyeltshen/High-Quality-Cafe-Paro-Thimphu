import React, { useState } from 'react';
import {
  Clock,
  ShoppingBag,
  Plus,
  RefreshCw,
  Utensils,
  Check,
  MessageSquare,
  Copy,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import {
  OrderRound,
  RestaurantTable,
  SystemSettings,
  OrderStatus,
  OrderItemKitchenStatus
} from '../types/index.ts';
import { OrderStatusTracker } from './OrderStatusTracker.tsx';

interface PreviousOrdersViewProps {
  orders: OrderRound[];
  currentTable?: RestaurantTable | null;
  settings: SystemSettings;
  onOrderMore: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onClearLocalOrders?: () => void;
  hasLocalAnonymousTokens?: boolean;
}

export const PreviousOrdersView: React.FC<PreviousOrdersViewProps> = ({
  orders,
  currentTable,
  settings,
  onOrderMore,
  onRefresh,
  isRefreshing = false,
  onClearLocalOrders,
  hasLocalAnonymousTokens = false
}) => {
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [confirmClearLocal, setConfirmClearLocal] = useState(false);

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const totalItemsCount = orders.reduce(
    (acc, order) => acc + order.items.reduce((sum, item) => sum + item.quantity, 0),
    0
  );

  const activeRoundsCount = orders.filter(
    o => o.status !== 'served' && o.status !== 'cancelled'
  ).length;

  const handleCopyConfirmation = async (orderNumber: string, orderId: string) => {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopiedOrderId(orderId);
      setTimeout(() => {
        setCopiedOrderId(prev => (prev === orderId ? null : prev));
      }, 2000);
    } catch {
      // Clipboard fallback not needed if unavailable
    }
  };

  const getOrderStatusLabel = (status: OrderStatus) => {
    switch (status) {
      case 'submitted':
        return { label: 'Order Received', tone: 'text-amber-800 font-semibold' };
      case 'acknowledged':
        return { label: 'Kitchen Acknowledged', tone: 'text-sky-800 font-semibold' };
      case 'preparing':
        return { label: 'Preparing Now', tone: 'text-sky-800 font-bold' };
      case 'ready':
        return { label: 'Ready for Service / Pickup', tone: 'text-emerald-800 font-bold' };
      case 'served':
        return { label: 'Completed', tone: 'text-stone-600 font-medium' };
      case 'cancelled':
        return { label: 'Cancelled', tone: 'text-rose-700 font-semibold' };
      default:
        return { label: status, tone: 'text-stone-700 font-medium' };
    }
  };

  const getItemKitchenStatusText = (status: OrderItemKitchenStatus) => {
    switch (status) {
      case 'preparing':
        return <span className="text-xs font-semibold text-sky-800">Preparing</span>;
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">
            <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>Ready</span>
          </span>
        );
      case 'cannot_prepare':
        return <span className="text-xs font-semibold text-rose-700">Unavailable</span>;
      case 'pending':
      default:
        return <span className="text-xs text-stone-500">Queued</span>;
    }
  };

  const formatOrderTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins === 1) return '1 min ago';
      if (diffMins < 60) return `${diffMins} mins ago`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    } catch {
      return '';
    }
  };

  const destinationLabel = currentTable
    ? `${currentTable.tableNumber} · ${currentTable.section}`
    : 'Counter Pickup';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Page Header Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span className="font-semibold text-teal-800">{destinationLabel}</span>
            <span aria-hidden="true">·</span>
            <span>Private Guest Session</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-display">
            Your Active &amp; Recent Orders
          </h2>
          <p className="text-xs sm:text-sm text-stone-600">
            Follow live kitchen updates right from your phone. Your order is tracked privately without storing your name.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-700 hover:text-stone-900 hover:bg-stone-50 transition-colors flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer"
              title="Refresh live order status"
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin text-teal-700' : ''}`} />
              <span>Refresh</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOrderMore}
            className="min-h-[44px] px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Add More Items</span>
          </button>
        </div>
      </div>

      {/* Privacy & Shared-Device Local Token Control */}
      <div className="bg-white rounded-xl border border-stone-200 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5 text-stone-600">
          <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-stone-900">Private Device Tracking:</strong> Only orders placed from this browser or your verified table QR appear here. Complete café order archives are restricted to authorized management.
          </p>
        </div>

        {hasLocalAnonymousTokens && onClearLocalOrders && (
          <div className="shrink-0 self-end sm:self-center">
            {!confirmClearLocal ? (
              <button
                type="button"
                onClick={() => setConfirmClearLocal(true)}
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span>Clear Device History</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClearLocalOrders();
                    setConfirmClearLocal(false);
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearLocal(false)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-700 font-medium hover:bg-stone-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary Metrics Bar */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-stone-200 text-center space-y-0.5">
            <span className="text-xs font-medium text-stone-500 block truncate">
              Order Rounds
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-stone-900 block">
              {orders.length}
            </span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-stone-200 text-center space-y-0.5">
            <span className="text-xs font-medium text-stone-500 block truncate">
              In Progress
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-teal-800 block">
              {activeRoundsCount}
            </span>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-stone-200 text-center space-y-0.5">
            <span className="text-xs font-medium text-stone-500 block truncate">
              Total Dishes
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-stone-900 block">
              {totalItemsCount}
            </span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 bg-teal-50 border border-teal-200/80 text-teal-800 rounded-2xl flex items-center justify-center mx-auto">
            <Utensils className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-stone-900 font-display">
              No Orders Placed Yet
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Explore our menu and place your order whenever you&apos;re ready—no account, name, or phone number needed. Your Confirmation ID and live preparation progress will appear right here.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onOrderMore}
              className="min-h-[44px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>Explore Menu</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedOrders.map(order => {
            const statusInfo = getOrderStatusLabel(order.status);
            const isCopied = copiedOrderId === order.id;
            const orderDestination =
              order.tableId === 'TAKEAWAY'
                ? 'Counter Pickup'
                : order.tableNumber || order.tableId;

            return (
              <article
                key={order.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden"
              >
                {/* Order Header */}
                <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-bold text-stone-900 font-mono tabular-nums text-base sm:text-lg">
                        {order.orderNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyConfirmation(order.orderNumber, order.id)}
                        className="min-h-[34px] px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                        title="Copy Order Confirmation Number"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                            <span>Copy ID</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <span>{order.anonymousLabel || 'Anonymous Guest'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-stone-700">{orderDestination}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>
                          {formatOrderTime(order.createdAt)} ({getRelativeTime(order.createdAt)})
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className={`text-xs sm:text-sm ${statusInfo.tone}`}>
                    {statusInfo.label}
                  </div>
                </div>

                {/* Progress Stepper */}
                <div className="p-4 sm:p-5 bg-white border-b border-stone-100">
                  <OrderStatusTracker
                    status={order.status}
                    orderNumber={order.orderNumber}
                    orderTime={formatOrderTime(order.createdAt)}
                    variant="full"
                  />
                </div>

                {/* Items List */}
                <div className="p-4 sm:p-5 space-y-3">
                  <h4 className="text-xs font-bold text-stone-700">
                    Ordered Dishes ({order.items.reduce((s, it) => s + it.quantity, 0)})
                  </h4>

                  <div className="divide-y divide-stone-100">
                    {order.items.map(item => (
                      <div
                        key={item.id}
                        className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-xs sm:text-sm"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono tabular-nums font-bold text-stone-900">
                              {item.quantity}×
                            </span>
                            <span className="font-semibold text-stone-900">{item.name}</span>
                            <span className="text-xs text-stone-500">
                              · {item.dietType === 'veg' ? 'Pure Veg' : item.dietType === 'vegan' ? 'Vegan' : 'Non-Veg'}
                            </span>
                          </div>

                          {item.customizations.length > 0 && (
                            <div className="text-xs text-stone-500 pl-6">
                              {item.customizations.map(c => c.optionName).join(' · ')}
                            </div>
                          )}

                          {item.specialInstructions && (
                            <div className="text-xs text-amber-800 pl-6">
                              Note: {item.specialInstructions}
                            </div>
                          )}

                          {item.rejectionReason && (
                            <div className="text-xs text-rose-700 font-medium pl-6">
                              Kitchen note: {item.rejectionReason}
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0 space-y-0.5">
                          <div>{getItemKitchenStatusText(item.kitchenStatus)}</div>
                          {settings.showPricesOnCustomerMenu && (
                            <div className="font-mono tabular-nums text-stone-900 font-bold text-xs">
                              Nu. {item.unitPrice * item.quantity}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {order.customerNote && (
                    <div className="mt-3 p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-stone-900 mr-1">Kitchen Note:</span>
                        <span>{order.customerNote}</span>
                      </div>
                    </div>
                  )}

                  {settings.showPricesOnCustomerMenu && (
                    <div className="pt-3 border-t border-stone-100 flex justify-between items-center text-xs sm:text-sm">
                      <span className="font-medium text-stone-600">Round Subtotal</span>
                      <span className="font-mono tabular-nums font-bold text-stone-900">
                        Nu. {order.subtotal}
                      </span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {/* Friendly Light Callout for Ordering Another Round */}
          <div className="p-5 sm:p-6 bg-white border border-stone-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="font-bold text-sm sm:text-base font-display text-stone-900">
                Would you like anything else?
              </h4>
              <p className="text-xs sm:text-sm text-stone-600">
                Add another drink, dessert, or dish anytime—new items are sent straight to the kitchen.
              </p>
            </div>

            <button
              type="button"
              onClick={onOrderMore}
              className="min-h-[44px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shrink-0 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Browse Menu</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
