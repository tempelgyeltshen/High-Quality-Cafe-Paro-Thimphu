import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  Shield,
  MessageSquare,
  ChevronRight,
  Loader2
} from 'lucide-react';
import {
  OrderHistoryRecord,
  OrderHistorySummary,
  OrderStatus,
  RestaurantTable,
  StaffUser
} from '../types/index.ts';
import { api, downloadProtectedCsv } from '../lib/api.ts';

interface OrderHistoryViewProps {
  currentUser: StaffUser | null;
  tables: RestaurantTable[];
  liveOrderSignal?: number;
  onOrderUpdated?: () => void;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: 'Order Received',
  acknowledged: 'Acknowledged',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served / Completed',
  cancelled: 'Cancelled'
};

const STATUS_BADGE_TONES: Record<OrderStatus, string> = {
  submitted: 'bg-amber-50 text-amber-900 border-amber-200',
  acknowledged: 'bg-amber-50 text-amber-900 border-amber-200',
  preparing: 'bg-sky-50 text-sky-900 border-sky-200',
  ready: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  served: 'bg-stone-100 text-stone-700 border-stone-200',
  cancelled: 'bg-rose-50 text-rose-900 border-rose-200'
};

export const OrderHistoryView: React.FC<OrderHistoryViewProps> = ({
  currentUser,
  tables,
  liveOrderSignal = 0,
  onOrderUpdated
}) => {
  const [orders, setOrders] = useState<OrderHistoryRecord[]>([]);
  const [summary, setSummary] = useState<OrderHistorySummary>({
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalOrderValue: 0
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Order Record Inspector & Status Management
  const [selectedOrder, setSelectedOrder] = useState<OrderHistoryRecord | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [statusUpdateMessage, setStatusUpdateMessage] = useState<string | null>(null);
  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.getCompleteOrderHistory({
        status: statusFilter,
        tableId: tableFilter,
        dateRange,
        search: debouncedSearch
      });
      setOrders(res.orders);
      setSummary(res.summary);
      setSelectedOrder(prev => {
        if (!prev) return null;
        return res.orders.find(o => o.id === prev.id) || prev;
      });
    } catch (err: any) {
      setError(err.message || 'Unable to load complete order history');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, tableFilter, dateRange, debouncedSearch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, liveOrderSignal]);

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      setExportError(null);
      const dateStamp = new Date().toISOString().slice(0, 10);
      await downloadProtectedCsv(
        '/api/admin/orders/export-csv',
        `high_quality_cafe_order_history_${dateStamp}.csv`
      );
    } catch (err: any) {
      setExportError(err.message || 'Failed to download order history CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      setIsUpdatingStatus(true);
      setStatusUpdateMessage(null);
      await api.updateAdminOrderStatus(orderId, nextStatus);
      setConfirmCancelOrderId(null);
      setStatusUpdateMessage(`Order status updated to "${STATUS_LABELS[nextStatus]}".`);
      await fetchHistory();
      onOrderUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Failed to update order status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })}`;
    } catch {
      return iso;
    }
  };

  const roleTitle = currentUser?.role === 'admin' ? 'Admin' : 'GM (General Manager)';

  return (
    <div className="space-y-6">
      {/* Confidential Record Archive Header */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <Shield className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span className="font-semibold text-teal-900">Confidential Record Archive</span>
            <span aria-hidden="true">·</span>
            <span>Restricted to {roleTitle}</span>
            <span aria-hidden="true">·</span>
            <span>Anonymous Privacy Enforced</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-stone-900 font-display">
            Complete Order History &amp; Status Management
          </h2>
          <p className="text-xs text-stone-500 max-w-2xl leading-relaxed">
            Review active and historical orders across dining tables and anonymous pickup. Personal guest identities are never collected; records are indexed strictly by unique Order ID.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchHistory}
            disabled={isLoading}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-700' : 'text-stone-500'}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Preparing CSV...' : 'Export Order History CSV'}</span>
          </button>
        </div>
      </div>

      {exportError && (
        <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{exportError}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="text-rose-700 hover:text-rose-900 font-semibold px-2 py-1 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchHistory}
            className="text-rose-700 hover:text-rose-900 font-semibold underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 space-y-1">
          <span className="text-xs font-medium text-stone-500 block">Total Recorded Orders</span>
          <div className="text-xl sm:text-2xl font-bold text-stone-900 font-mono tabular-nums">
            {summary.totalOrders}
          </div>
          <p className="text-[11px] text-stone-500">All table &amp; pickup orders</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 space-y-1">
          <span className="text-xs font-medium text-stone-500 block">Active In-Progress</span>
          <div className="text-xl sm:text-2xl font-bold text-amber-800 font-mono tabular-nums">
            {summary.activeOrders}
          </div>
          <p className="text-[11px] text-stone-500">Pending, preparing, or ready</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 space-y-1">
          <span className="text-xs font-medium text-stone-500 block">Completed / Served</span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            {summary.completedOrders}
          </div>
          <p className="text-[11px] text-stone-500">Fulfilled guest orders</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 space-y-1">
          <span className="text-xs font-medium text-stone-500 block">Gross Order Subtotal</span>
          <div className="text-xl sm:text-2xl font-bold text-stone-900 font-mono tabular-nums">
            Nu. {summary.totalOrderValue}
          </div>
          <p className="text-[11px] text-stone-500">Excludes {summary.cancelledOrders} cancelled</p>
        </div>
      </div>

      {/* Interactive Search & Filter Controls */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'active', label: 'Active Queue' },
            { id: 'submitted', label: 'Received' },
            { id: 'preparing', label: 'Preparing' },
            { id: 'ready', label: 'Ready' },
            { id: 'served', label: 'Served / Past' },
            { id: 'cancelled', label: 'Cancelled' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white text-stone-900 shadow-xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <label htmlFor="history-search-input" className="sr-only">
              Search orders by Order ID, dish name, or kitchen note
            </label>
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="history-search-input"
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search Order ID (#HQC-...), dish, or note..."
              className="w-full h-11 pl-10 pr-14 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-500 hover:text-stone-800 px-1.5 py-1 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filter by table or channel"
              value={tableFilter}
              onChange={e => setTableFilter(e.target.value)}
              className="w-full h-11 px-3 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
            >
              <option value="all">All Tables &amp; Channels</option>
              <option value="TAKEAWAY">Anonymous Counter Pickup</option>
              {tables
                .filter(t => t.id !== 'TAKEAWAY')
                .map(t => (
                  <option key={t.id} value={t.id}>
                    {t.tableNumber} ({t.section})
                  </option>
                ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filter by time period"
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="w-full h-11 px-3 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-700"
            >
              <option value="all">All Time History</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Order History Results */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        {isLoading && orders.length === 0 ? (
          <div className="py-14 text-center space-y-2 text-xs text-stone-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-teal-700" />
            <p>Loading confidential order records...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-14 px-4 text-center space-y-3">
            <Clock className="w-7 h-7 text-stone-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-stone-900">No matching order records</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                No orders match your current search or filter selection. Reset filters to view all records.
              </p>
            </div>
            {(statusFilter !== 'all' || tableFilter !== 'all' || dateRange !== 'all' || searchInput) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setTableFilter('all');
                  setDateRange('all');
                  setSearchInput('');
                }}
                className="min-h-[40px] px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Channel &amp; Privacy</th>
                    <th className="py-3.5 px-4">Items Ordered</th>
                    <th className="py-3.5 px-4 text-right">Subtotal</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {orders.map(order => {
                    const totalQty = order.items.reduce((s, it) => s + it.quantity, 0);
                    return (
                      <tr key={order.id} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-stone-900 tabular-nums">
                            {order.orderNumber}
                          </div>
                          <div className="text-[11px] text-stone-500 font-mono">
                            Round #{order.roundNumber}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-stone-600 font-mono tabular-nums whitespace-nowrap">
                          {formatTimestamp(order.createdAt)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-stone-900">{order.tableNumber}</div>
                          <div className="text-[11px] text-stone-500">
                            {order.anonymousLabel || 'Anonymous Guest'} · Zero PII
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-medium text-stone-800 truncate">
                            {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {totalQty} {totalQty === 1 ? 'item' : 'items'}
                            {order.billNumber ? ` · ${order.billNumber} (${order.billStatus})` : ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-900 tabular-nums whitespace-nowrap">
                          Nu. {order.subtotal}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${STATUS_BADGE_TONES[order.status]}`}
                          >
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setStatusUpdateMessage(null);
                              setConfirmCancelOrderId(null);
                              setSelectedOrder(order);
                            }}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50 text-stone-800 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-stone-500" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile & Tablet Stacked Cards */}
            <div className="md:hidden divide-y divide-stone-200">
              {orders.map(order => {
                const totalQty = order.items.reduce((s, it) => s + it.quantity, 0);
                return (
                  <div key={order.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-sm text-stone-900 tabular-nums block">
                          {order.orderNumber}
                        </span>
                        <span className="text-xs text-stone-500">
                          {order.tableNumber} · {order.anonymousLabel || 'Anonymous Guest'}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${STATUS_BADGE_TONES[order.status]}`}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>

                    <div className="text-xs text-stone-700 line-clamp-2">
                      {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs gap-2">
                      <div className="text-stone-500 font-mono tabular-nums text-[11px]">
                        {formatTimestamp(order.createdAt)} · {totalQty} items ·{' '}
                        <strong className="text-stone-900">Nu. {order.subtotal}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusUpdateMessage(null);
                          setConfirmCancelOrderId(null);
                          setSelectedOrder(order);
                        }}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-900 font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Order Record Inspector & Status Management Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-inspector-title"
            className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-xl border border-stone-200 space-y-5 my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
              <div className="space-y-1">
                <div className="text-xs text-stone-500 flex flex-wrap items-center gap-1.5">
                  <span>Confidential Order Record</span>
                  <span aria-hidden="true">·</span>
                  <span>Round #{selectedOrder.roundNumber}</span>
                </div>
                <h3 id="order-inspector-title" className="text-lg font-bold text-stone-900 font-mono tabular-nums">
                  {selectedOrder.orderNumber}
                </h3>
                <p className="text-xs text-stone-500">
                  {selectedOrder.tableNumber} ({selectedOrder.section}) · Placed {formatTimestamp(selectedOrder.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
                className="w-9 h-9 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {statusUpdateMessage && (
              <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusUpdateMessage}</span>
              </div>
            )}

            {/* Privacy & Billing Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-stone-50 rounded-xl p-3.5 border border-stone-200 text-xs">
              <div className="space-y-1">
                <span className="text-stone-500 block">Guest Identity</span>
                <span className="font-semibold text-stone-900 block">
                  {selectedOrder.anonymousLabel || 'Anonymous Guest'}
                </span>
                <span className="text-[11px] text-stone-500 block">
                  Zero personal name, email, or phone stored
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-stone-500 block">Billing &amp; Settlement</span>
                <span className="font-semibold text-stone-900 font-mono tabular-nums block">
                  {selectedOrder.billNumber || 'Unbilled'} · Nu. {selectedOrder.subtotal} subtotal
                </span>
                {selectedOrder.billStatus && (
                  <span className="text-[11px] text-stone-500 block capitalize">
                    Invoice status: {selectedOrder.billStatus} (Total Nu. {selectedOrder.billTotal ?? selectedOrder.subtotal})
                  </span>
                )}
              </div>
            </div>

            {/* Itemized Breakdown */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-stone-800">
                Ordered Items ({selectedOrder.items.reduce((s, it) => s + it.quantity, 0)})
              </h4>
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl px-3.5">
                {selectedOrder.items.map(item => (
                  <div key={item.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-stone-900">
                        <span className="font-mono tabular-nums mr-1.5">{item.quantity}x</span>
                        {item.name}
                      </div>
                      {item.customizations.length > 0 && (
                        <div className="text-[11px] text-stone-500">
                          {item.customizations.map(c => `${c.groupName}: ${c.optionName}`).join(' · ')}
                        </div>
                      )}
                      {item.specialInstructions && (
                        <div className="text-[11px] text-amber-900 font-medium">
                          Prep note: &ldquo;{item.specialInstructions}&rdquo;
                        </div>
                      )}
                      {item.rejectionReason && (
                        <div className="text-[11px] text-rose-700">
                          Kitchen note: {item.rejectionReason}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-stone-900 tabular-nums">
                        Nu. {item.unitPrice * item.quantity}
                      </div>
                      <div className="text-[11px] text-stone-500 capitalize">
                        {item.kitchenStatus.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedOrder.customerNote && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold mr-1">Order Note:</span>
                    <span>{selectedOrder.customerNote}</span>
                  </div>
                </div>
              )}
            </div>

            {/* GM & Admin Order Status Controls */}
            <div className="space-y-3 border-t border-stone-100 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-800">Update Order Status</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${STATUS_BADGE_TONES[selectedOrder.status]}`}
                >
                  {STATUS_LABELS[selectedOrder.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(['submitted', 'acknowledged', 'preparing', 'ready', 'served'] as OrderStatus[]).map(st => {
                  const isActive = selectedOrder.status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={isUpdatingStatus || isActive}
                      onClick={() => handleStatusChange(selectedOrder.id, st)}
                      className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-teal-700 text-white border-teal-700 cursor-default font-bold'
                          : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
                      }`}
                    >
                      {st === 'submitted'
                        ? 'Received'
                        : st === 'acknowledged'
                        ? 'Acknowledge'
                        : st === 'preparing'
                        ? 'Preparing'
                        : st === 'ready'
                        ? 'Ready'
                        : 'Served'}
                    </button>
                  );
                })}
              </div>

              {/* Two-step Cancel Confirmation */}
              {selectedOrder.status !== 'cancelled' && (
                <div className="pt-1">
                  {confirmCancelOrderId === selectedOrder.id ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <span className="text-rose-900 font-medium">
                        Cancel {selectedOrder.orderNumber} and deduct from open bill?
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmCancelOrderId(null)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-700 font-semibold cursor-pointer"
                        >
                          Keep Order
                        </button>
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => handleStatusChange(selectedOrder.id, 'cancelled')}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                        >
                          Confirm Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmCancelOrderId(selectedOrder.id)}
                      className="text-xs font-semibold text-rose-700 hover:text-rose-900 py-1.5 cursor-pointer"
                    >
                      Cancel this order...
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="min-h-[42px] px-5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
