import React from 'react';
import {
  Clock,
  CheckCircle2,
  ChefHat,
  ShoppingBag,
  Plus,
  RefreshCw,
  Utensils,
  AlertCircle,
  Sparkles,
  Flame,
  Check,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { OrderRound, RestaurantTable, SystemSettings, OrderStatus, OrderItemKitchenStatus } from '../types/index.ts';
import { OrderStatusTracker } from './OrderStatusTracker.tsx';

interface PreviousOrdersViewProps {
  orders: OrderRound[];
  currentTable: RestaurantTable;
  settings: SystemSettings;
  onOrderMore: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const PreviousOrdersView: React.FC<PreviousOrdersViewProps> = ({
  orders,
  currentTable,
  settings,
  onOrderMore,
  onRefresh,
  isRefreshing = false
}) => {
  // Sort orders descending by creation date (newest round at top)
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

  const getOrderStatusConfig = (status: OrderStatus) => {
    switch (status) {
      case 'submitted':
        return {
          label: 'Order Received',
          color: 'bg-blue-50 text-blue-700 border-blue-200',
          dotColor: 'bg-blue-500',
          step: 1,
          description: 'Ticket received by kitchen queue'
        };
      case 'acknowledged':
        return {
          label: 'Kitchen Acknowledged',
          color: 'bg-amber-50 text-amber-700 border-amber-200',
          dotColor: 'bg-amber-500',
          step: 2,
          description: 'Chef has queued your ticket for preparation'
        };
      case 'preparing':
        return {
          label: 'Cooking / Preparing',
          color: 'bg-amber-500/10 text-amber-800 border-amber-300 font-bold animate-pulse',
          dotColor: 'bg-amber-500',
          step: 2,
          description: 'Dishes are being cooked fresh by the kitchen team'
        };
      case 'ready':
        return {
          label: 'Ready to Serve',
          color: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
          dotColor: 'bg-emerald-500',
          step: 3,
          description: 'Dishes are plated and on their way to your table'
        };
      case 'served':
        return {
          label: 'Served to Table',
          color: 'bg-stone-100 text-stone-600 border-stone-200',
          dotColor: 'bg-stone-400',
          step: 4,
          description: 'Dishes delivered to your table. Enjoy your meal!'
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          color: 'bg-rose-50 text-rose-700 border-rose-200',
          dotColor: 'bg-rose-500',
          step: 0,
          description: 'Order was cancelled'
        };
      default:
        return {
          label: status,
          color: 'bg-stone-100 text-stone-700 border-stone-200',
          dotColor: 'bg-stone-400',
          step: 1,
          description: ''
        };
    }
  };

  const getItemKitchenStatusBadge = (status: OrderItemKitchenStatus) => {
    switch (status) {
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            Cooking
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <Check className="w-3 h-3 text-emerald-600" />
            Ready
          </span>
        );
      case 'cannot_prepare':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
            Out of Stock
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
            Queued
          </span>
        );
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Session Header Card */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-800 border border-amber-500/20 rounded-full text-xs font-mono font-bold uppercase tracking-wider">
              {currentTable.tableNumber}
            </span>
            <span className="text-xs text-stone-500">
              {currentTable.section}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-display">
            Previous Orders & Live Kitchen Status
          </h1>
          <p className="text-xs text-stone-500">
            Real-time status of all rounds ordered for your table during this visit
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors"
              title="Refresh order status"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
            </button>
          )}

          <button
            onClick={onOrderMore}
            className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Order More Dishes</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar (if orders exist) */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-white p-2.5 sm:p-4 rounded-xl border border-stone-200/80 shadow-xs text-center">
            <span className="text-[10px] sm:text-[11px] font-semibold text-stone-500 block uppercase truncate">
              Total Rounds
            </span>
            <span className="text-lg sm:text-2xl font-bold font-mono text-stone-900">
              {orders.length}
            </span>
          </div>

          <div className="bg-white p-2.5 sm:p-4 rounded-xl border border-stone-200/80 shadow-xs text-center">
            <span className="text-[10px] sm:text-[11px] font-semibold text-stone-500 block uppercase truncate">
              In Kitchen
            </span>
            <span className="text-lg sm:text-2xl font-bold font-mono text-amber-700">
              {activeRoundsCount}
            </span>
          </div>

          <div className="bg-white p-2.5 sm:p-4 rounded-xl border border-stone-200/80 shadow-xs text-center">
            <span className="text-[10px] sm:text-[11px] font-semibold text-stone-500 block uppercase truncate">
              Total Dishes
            </span>
            <span className="text-lg sm:text-2xl font-bold font-mono text-stone-900">
              {totalItemsCount}
            </span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200/80 p-8 sm:p-12 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-amber-200/60">
            <Utensils className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-stone-900 font-display">
              No Orders Placed Yet for {currentTable.tableNumber}
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              When you submit an order round from the menu, your order tickets, live cooking progress, and dish history will appear here in real time.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={onOrderMore}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors inline-flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Browse Menu & Place First Order</span>
            </button>
          </div>
        </div>
      ) : (
        /* Order Rounds List */
        <div className="space-y-5">
          {sortedOrders.map((order) => {
            const statusConfig = getOrderStatusConfig(order.status);
            const isDelivered = order.status === 'served';
            const isCooking = order.status === 'preparing' || order.status === 'acknowledged';

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden transition-all hover:border-stone-300"
              >
                {/* Round Header */}
                <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-800 border border-amber-500/20 font-mono font-bold text-sm flex items-center justify-center shrink-0">
                      #{order.roundNumber}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 font-mono text-sm">
                          {order.orderNumber}
                        </span>
                        <span className="text-[11px] text-stone-500 font-medium">
                          · Round #{order.roundNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-stone-500">
                        <Clock className="w-3 h-3 text-stone-400" />
                        <span>Placed at {formatOrderTime(order.createdAt)}</span>
                        <span>({getRelativeTime(order.createdAt)})</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${statusConfig.color}`}>
                      <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
                      <span>{statusConfig.label}</span>
                    </span>
                  </div>
                </div>

                {/* Visual Order Progress Tracker: Placed -> Preparing -> Ready */}
                <div className="p-4 sm:p-5 bg-white border-b border-stone-100">
                  <OrderStatusTracker
                    status={order.status}
                    orderNumber={order.orderNumber}
                    orderTime={formatOrderTime(order.createdAt)}
                    variant="full"
                  />
                </div>

                {/* Items in this Round */}
                <div className="p-4 sm:p-5 space-y-3">
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Dishes in this Round ({order.items.reduce((s, it) => s + it.quantity, 0)})
                  </h4>

                  <div className="divide-y divide-stone-100 space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="pt-2 first:pt-0 flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-stone-900">
                              {item.quantity}x
                            </span>
                            <span className="font-semibold text-stone-900">
                              {item.name}
                            </span>
                            {item.dietType === 'veg' && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Veg
                              </span>
                            )}
                          </div>

                          {/* Customizations */}
                          {item.customizations.length > 0 && (
                            <div className="text-[11px] text-stone-500 pl-6 flex flex-wrap gap-1">
                              {item.customizations.map((c, idx) => (
                                <span key={idx} className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
                                  {c.optionName}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Special instructions */}
                          {item.specialInstructions && (
                            <div className="text-[11px] text-amber-700 italic pl-6">
                              * {item.specialInstructions}
                            </div>
                          )}

                          {item.rejectionReason && (
                            <div className="text-[11px] text-rose-600 pl-6">
                              Note from Kitchen: {item.rejectionReason}
                            </div>
                          )}
                        </div>

                        {/* Status Chip / Price */}
                        <div className="text-right shrink-0 space-y-1">
                          <div>
                            {getItemKitchenStatusBadge(item.kitchenStatus)}
                          </div>
                          {settings.showPricesOnCustomerMenu && (
                            <div className="font-mono text-stone-700 font-bold text-[11px]">
                              Nu. {item.unitPrice * item.quantity}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Customer Note if present */}
                  {order.customerNote && (
                    <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold mr-1">Kitchen Note:</span>
                        <span>{order.customerNote}</span>
                      </div>
                    </div>
                  )}

                  {/* Subtotal if prices enabled */}
                  {settings.showPricesOnCustomerMenu && (
                    <div className="pt-3 border-t border-stone-100 flex justify-between items-center text-xs">
                      <span className="font-semibold text-stone-500">Round #{order.roundNumber} Subtotal</span>
                      <span className="font-mono font-bold text-stone-900 text-sm">Nu. {order.subtotal}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Bottom Action Card */}
          <div className="p-5 bg-stone-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div className="space-y-0.5">
              <h4 className="font-bold text-sm font-display text-white">
                Want to add more dishes or drinks?
              </h4>
              <p className="text-xs text-stone-400">
                You can place additional rounds anytime. All rounds are prepared to order and grouped under {currentTable.tableNumber}.
              </p>
            </div>

            <button
              onClick={onOrderMore}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Items to Order</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
