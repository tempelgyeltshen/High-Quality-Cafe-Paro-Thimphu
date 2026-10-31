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
        return { label: 'Received by Kitchen', tone: 'text-sky-800 font-semibold' };
      case 'preparing':
        return { label: 'Preparing Now', tone: 'text-sky-800 font-bold' };
      case 'ready':
        return { label: 'Ready to Serve', tone: 'text-emerald-800 font-bold' };
      case 'served':
        return { label: 'Served', tone: 'text-stone-600 font-medium' };
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

  const getCleanDestination = (order: OrderRound) => {
    if (
      order.tableId === 'TAKEAWAY' ||
      !order.tableNumber ||
      order.tableNumber.toLowerCase().includes('anonymous')
    ) {
      return 'Counter Pickup';
    }
    return order.tableNumber;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Clean Page Header */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          {currentTable && (
            <div className="text-xs font-semibold text-teal-800">
              {currentTable.tableNumber}
              {currentTable.section ? ` · ${currentTable.section}` : ''}
            </div>
          )}
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-display">
            My Orders
          </h2>
          <p className="text-xs sm:text-sm text-stone-600">
            Track live preparation updates for your current dishes and drinks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto shrink-0">
          {hasLocalAnonymousTokens && onClearLocalOrders && orders.length > 0 && (
            !confirmClearLocal ? (
              <button
                type="button"
                onClick={() => setConfirmClearLocal(true)}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-900 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>Clear List</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearLocalOrders();
                    setConfirmClearLocal(false);
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearLocal(false)}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-700 hover:text-stone-900 hover:bg-stone-50 transition-colors flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer"
              title="Refresh order status"
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
            <span>Order More</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 bg-teal-50 border border-teal-200/80 text-teal-800 rounded-2xl flex items-center justify-center mx-auto">
            <Utensils className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-stone-900 font-display">
              No Orders Yet
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Browse the menu to select your favorite dishes and drinks. Your live order status will appear right here.
            </p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={onOrderMore}
              className="min-h-[44px] px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>View Menu</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedOrders.map(order => {
            const statusInfo = getOrderStatusLabel(order.status);
            const isCopied = copiedOrderId === order.id;
            const orderDestination = getCleanDestination(order);

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
                        title="Copy order number"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
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
                    Items ({order.items.reduce((s, it) => s + it.quantity, 0)})
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
                            <span
                              className={
                                item.kitchenStatus === 'cannot_prepare'
                                  ? 'line-through text-stone-400 font-semibold'
                                  : 'font-semibold text-stone-900'
                              }
                            >
                              {item.name}
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
                            <div
                              className={`font-mono tabular-nums font-bold text-xs ${
                                item.kitchenStatus === 'cannot_prepare'
                                  ? 'line-through text-stone-400'
                                  : 'text-stone-900'
                              }`}
                            >
                              Nu.{' '}
                              {item.kitchenStatus === 'cannot_prepare'
                                ? 0
                                : Math.round(item.unitPrice * item.quantity * 100) / 100}
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
                        <span className="font-semibold text-stone-900 mr-1">Note:</span>
                        <span>{order.customerNote}</span>
                      </div>
                    </div>
                  )}

                  {settings.showPricesOnCustomerMenu && (
                    <div className="pt-3 border-t border-stone-100 flex justify-between items-center text-xs sm:text-sm">
                      <span className="font-medium text-stone-600">Subtotal</span>
                      <span className="font-mono tabular-nums font-bold text-stone-900">
                        Nu. {order.subtotal}
                      </span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
