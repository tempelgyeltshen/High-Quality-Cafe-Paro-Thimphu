import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Clock,
  Check,
  AlertTriangle,
  Volume2,
  VolumeX,
  Search,
  X,
  RefreshCw,
  WifiOff,
  SlidersHorizontal,
  Ban,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { OrderRound, OrderItemKitchenStatus, OrderStatus } from '../types/index.ts';
import { RealTimeConnectionState } from '../lib/api.ts';
import { soundService, SoundTone } from '../lib/audio.ts';
import { KitchenOrderAlert, AlertOrderNotification } from './KitchenOrderAlert.tsx';

export type KitchenSectionTab = 'board' | 'pending' | 'preparing' | 'ready' | 'cancelled';

interface KitchenDisplayProps {
  orders: OrderRound[];
  onUpdateItemStatus: (
    orderId: string,
    itemId: string,
    status: OrderItemKitchenStatus,
    reason?: string
  ) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  incomingAlerts?: AlertOrderNotification[];
  onDismissAlert?: (id: string) => void;
  onSimulateOrder?: () => void;
  isConnected?: boolean;
  connectionState?: RealTimeConnectionState;
  isLoadingOrders?: boolean;
  onRefreshOrders?: () => Promise<void> | void;
}

type PriorityLevel = 'overdue' | 'urgent' | 'normal';

interface ToastFeedback {
  id: number;
  message: string;
}

function getKitchenStage(status: OrderStatus): 'pending' | 'preparing' | 'ready' | 'cancelled' | 'served' {
  if (status === 'submitted' || status === 'acknowledged') return 'pending';
  if (status === 'preparing') return 'preparing';
  if (status === 'ready') return 'ready';
  if (status === 'cancelled') return 'cancelled';
  return 'served';
}

function formatOrderTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '--:--';
  }
}

export const KitchenDisplay: React.FC<KitchenDisplayProps> = ({
  orders,
  onUpdateItemStatus,
  onUpdateOrderStatus,
  incomingAlerts = [],
  onDismissAlert,
  isConnected = true,
  connectionState = 'connected',
  isLoadingOrders = false,
  onRefreshOrders
}) => {
  const [desktopTab, setDesktopTab] = useState<KitchenSectionTab>('board');
  const [mobileTab, setMobileTab] = useState<'pending' | 'preparing' | 'ready' | 'cancelled'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Audio controls
  const [audioEnabled, setAudioEnabled] = useState(soundService.isEnabled());
  const [selectedTone, setSelectedTone] = useState<SoundTone>(soundService.getTone());
  const [audioVolume, setAudioVolume] = useState<number>(soundService.getVolume());
  const [showSoundSettings, setShowSoundSettings] = useState(false);

  // Elapsed timer tick
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Duplicate-action prevention locks & states
  const inFlightOrdersRef = useRef<Set<string>>(new Set());
  const inFlightItemsRef = useRef<Set<string>>(new Set());
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Record<string, boolean>>({});
  const [updatingItemIds, setUpdatingItemIds] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Feedback, error, and newly arrived tracking
  const [confirmationToast, setConfirmationToast] = useState<ToastFeedback | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [dismissedCancelledIds, setDismissedCancelledIds] = useState<Set<string>>(new Set());
  const [recentlyArrivedIds, setRecentlyArrivedIds] = useState<Record<string, number>>({});
  const knownOrderIdsRef = useRef<Set<string> | null>(null);

  // Item unavailability modal state
  const [rejectingItem, setRejectingItem] = useState<{
    orderId: string;
    orderNumber: string;
    itemId: string;
    itemName: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const ticketRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (knownOrderIdsRef.current === null) {
      knownOrderIdsRef.current = new Set(orders.map(o => o.id));
      return;
    }

    const now = Date.now();
    const newEntries: Record<string, number> = {};
    for (const ord of orders) {
      if (!knownOrderIdsRef.current.has(ord.id)) {
        knownOrderIdsRef.current.add(ord.id);
        if (getKitchenStage(ord.status) === 'pending') {
          newEntries[ord.id] = now;
        }
      }
    }

    if (Object.keys(newEntries).length > 0) {
      setRecentlyArrivedIds(prev => ({ ...prev, ...newEntries }));
    }
  }, [orders]);

  useEffect(() => {
    if (!confirmationToast) return;
    const timer = setTimeout(() => {
      setConfirmationToast(current => (current?.id === confirmationToast.id ? null : current));
    }, 3500);
    return () => clearTimeout(timer);
  }, [confirmationToast]);

  const showConfirmation = useCallback((message: string) => {
    setConfirmationToast({ id: Date.now(), message });
  }, []);

  const calculateElapsedMinutes = useCallback(
    (isoString: string) => {
      const diffMs = currentTime - new Date(isoString).getTime();
      return Math.max(0, Math.floor(diffMs / 60000));
    },
    [currentTime]
  );

  const getOrderPriority = useCallback(
    (order: OrderRound, elapsedMinutes: number): PriorityLevel => {
      const stage = getKitchenStage(order.status);
      if (stage !== 'pending' && stage !== 'preparing') return 'normal';

      if (elapsedMinutes >= 20) return 'overdue';

      const noteText = `${order.customerNote || ''} ${order.items
        .map(i => i.specialInstructions || '')
        .join(' ')}`.toLowerCase();
      const hasRushKeyword =
        noteText.includes('rush') || noteText.includes('urgent') || noteText.includes('asap');

      if (hasRushKeyword) return 'urgent';
      if (stage === 'pending' && elapsedMinutes >= 10) return 'urgent';
      if (stage === 'preparing' && elapsedMinutes >= 15) return 'urgent';

      return 'normal';
    },
    []
  );

  const searchFilteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(ord => {
      const matchesNum = ord.orderNumber.toLowerCase().includes(q);
      const matchesTable =
        (ord.tableNumber || ord.tableId).toLowerCase().includes(q) ||
        ord.tableId.toLowerCase().includes(q);
      const matchesDish = ord.items.some(it => it.name.toLowerCase().includes(q));
      const matchesNote =
        ord.customerNote?.toLowerCase().includes(q) ||
        ord.items.some(it => it.specialInstructions?.toLowerCase().includes(q));
      return matchesNum || matchesTable || matchesDish || matchesNote;
    });
  }, [orders, searchQuery]);

  const { pendingOrders, preparingOrders, readyOrders, cancelledOrders } = useMemo(() => {
    const pending: OrderRound[] = [];
    const preparing: OrderRound[] = [];
    const ready: OrderRound[] = [];
    const cancelled: OrderRound[] = [];

    for (const ord of searchFilteredOrders) {
      const stage = getKitchenStage(ord.status);
      if (stage === 'pending') {
        pending.push(ord);
      } else if (stage === 'preparing') {
        preparing.push(ord);
      } else if (stage === 'ready') {
        ready.push(ord);
      } else if (stage === 'cancelled' && !dismissedCancelledIds.has(ord.id)) {
        cancelled.push(ord);
      }
    }

    const sortByOldest = (a: OrderRound, b: OrderRound) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    const sortByUpdatedOldest = (a: OrderRound, b: OrderRound) =>
      new Date(a.updatedAt || a.createdAt).getTime() -
      new Date(b.updatedAt || b.createdAt).getTime();

    const sortByNewest = (a: OrderRound, b: OrderRound) =>
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime();

    pending.sort(sortByOldest);
    preparing.sort(sortByOldest);
    ready.sort(sortByUpdatedOldest);
    cancelled.sort(sortByNewest);

    return {
      pendingOrders: pending,
      preparingOrders: preparing,
      readyOrders: ready,
      cancelledOrders: cancelled
    };
  }, [searchFilteredOrders, dismissedCancelledIds]);

  const stageCounts = useMemo(() => {
    let pending = 0;
    let preparing = 0;
    let ready = 0;
    let cancelled = 0;
    for (const ord of orders) {
      const stage = getKitchenStage(ord.status);
      if (stage === 'pending') pending++;
      else if (stage === 'preparing') preparing++;
      else if (stage === 'ready') ready++;
      else if (stage === 'cancelled' && !dismissedCancelledIds.has(ord.id)) cancelled++;
    }
    return { pending, preparing, ready, cancelled };
  }, [orders, dismissedCancelledIds]);

  const handleOrderAction = async (order: OrderRound, targetStatus: OrderStatus) => {
    if (inFlightOrdersRef.current.has(order.id)) return;

    inFlightOrdersRef.current.add(order.id);
    setUpdatingOrderIds(prev => ({ ...prev, [order.id]: true }));
    setActionError(null);

    try {
      await onUpdateOrderStatus(order.id, targetStatus);

      setRecentlyArrivedIds(prev => {
        if (!(order.id in prev)) return prev;
        const copy = { ...prev };
        delete copy[order.id];
        return copy;
      });

      if (targetStatus === 'preparing') {
        showConfirmation(`${order.orderNumber} moved to Preparing`);
      } else if (targetStatus === 'ready') {
        showConfirmation(`${order.orderNumber} marked as Ready`);
      } else if (targetStatus === 'served') {
        showConfirmation(`${order.orderNumber} completed and cleared`);
      }
    } catch (err: any) {
      setActionError(
        err?.message ||
          `Could not update ${order.orderNumber}. Please check your connection and try again.`
      );
    } finally {
      inFlightOrdersRef.current.delete(order.id);
      setUpdatingOrderIds(prev => {
        const copy = { ...prev };
        delete copy[order.id];
        return copy;
      });
    }
  };

  const handleToggleItemReady = async (
    order: OrderRound,
    itemId: string,
    currentStatus: OrderItemKitchenStatus
  ) => {
    const lockKey = `${order.id}:${itemId}`;
    if (inFlightItemsRef.current.has(lockKey) || inFlightOrdersRef.current.has(order.id)) return;

    const nextStatus: OrderItemKitchenStatus = currentStatus === 'ready' ? 'preparing' : 'ready';
    inFlightItemsRef.current.add(lockKey);
    setUpdatingItemIds(prev => ({ ...prev, [lockKey]: true }));
    setActionError(null);

    try {
      await onUpdateItemStatus(order.id, itemId, nextStatus);
      const item = order.items.find(i => i.id === itemId);
      if (item && nextStatus === 'ready') {
        showConfirmation(`${item.quantity}× ${item.name} (${order.orderNumber}) ready`);
      }
    } catch (err: any) {
      setActionError(err?.message || `Could not update dish status for ${order.orderNumber}.`);
    } finally {
      inFlightItemsRef.current.delete(lockKey);
      setUpdatingItemIds(prev => {
        const copy = { ...prev };
        delete copy[lockKey];
        return copy;
      });
    }
  };

  const handleConfirmRejection = async () => {
    if (!rejectingItem) return;
    const lockKey = `${rejectingItem.orderId}:${rejectingItem.itemId}`;
    if (inFlightItemsRef.current.has(lockKey)) return;

    const reason = rejectionReason.trim() || 'Ingredient out of stock';
    inFlightItemsRef.current.add(lockKey);
    setUpdatingItemIds(prev => ({ ...prev, [lockKey]: true }));
    setActionError(null);

    try {
      await onUpdateItemStatus(
        rejectingItem.orderId,
        rejectingItem.itemId,
        'cannot_prepare',
        reason
      );
      showConfirmation(
        `Marked "${rejectingItem.itemName}" unavailable on ${rejectingItem.orderNumber}`
      );
      setRejectingItem(null);
      setRejectionReason('');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to mark dish unavailable.');
    } finally {
      inFlightItemsRef.current.delete(lockKey);
      setUpdatingItemIds(prev => {
        const copy = { ...prev };
        delete copy[lockKey];
        return copy;
      });
    }
  };

  const handleManualRefresh = async () => {
    if (!onRefreshOrders || isRefreshing) return;
    setIsRefreshing(true);
    setActionError(null);
    try {
      await onRefreshOrders();
      showConfirmation('Order queue synced');
    } catch {
      setActionError('Unable to refresh orders. Check network connection.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const focusTicket = (orderId: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (targetOrder) {
      const stage = getKitchenStage(targetOrder.status);
      if (
        stage === 'pending' ||
        stage === 'preparing' ||
        stage === 'ready' ||
        stage === 'cancelled'
      ) {
        setMobileTab(stage);
        if (desktopTab !== 'board' && desktopTab !== stage) {
          setDesktopTab('board');
        }
      }
    }
    setHighlightedOrderId(orderId);
    setTimeout(() => {
      const el = ticketRefs.current[orderId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);

    setTimeout(() => {
      setHighlightedOrderId(current => (current === orderId ? null : current));
    }, 5000);
  };

  const handleAlertStartPreparing = async (orderId: string) => {
    const target = orders.find(o => o.id === orderId);
    if (target) {
      await handleOrderAction(target, 'preparing');
      setMobileTab('preparing');
    } else {
      try {
        await onUpdateOrderStatus(orderId, 'preparing');
        showConfirmation('Order moved to Preparing');
      } catch (err: any) {
        setActionError(err?.message || 'Could not start order preparation.');
      }
    }
  };

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    soundService.setEnabled(next);
    if (next) soundService.playNewOrderChime();
  };

  const handleToneChange = (tone: SoundTone) => {
    setSelectedTone(tone);
    soundService.setTone(tone);
    soundService.playNewOrderChime(tone);
  };

  const handleVolumeChange = (vol: number) => {
    setAudioVolume(vol);
    soundService.setVolume(vol);
    soundService.playNewOrderChime();
  };

  const isConnectionLost =
    connectionState === 'reconnecting' || (!isConnected && connectionState !== 'connecting');

  const renderOrderCard = (order: OrderRound) => {
    const stage = getKitchenStage(order.status);
    const elapsed = calculateElapsedMinutes(order.createdAt);
    const priority = getOrderPriority(order, elapsed);
    const isUpdating = Boolean(updatingOrderIds[order.id]);
    const isHighlighted = highlightedOrderId === order.id;

    const arrivedTimestamp = recentlyArrivedIds[order.id];
    const isNewlyArrived =
      stage === 'pending' &&
      ((arrivedTimestamp && currentTime - arrivedTimestamp < 45000) ||
        currentTime - new Date(order.createdAt).getTime() < 45000);

    const destinationLabel =
      order.tableId === 'TAKEAWAY' ? 'Counter Pickup' : order.tableNumber || order.tableId;

    let statusLabel = 'Pending';
    let statusBadgeClass = 'bg-amber-50 text-amber-900 border-amber-200';
    if (stage === 'preparing') {
      statusLabel = 'Preparing';
      statusBadgeClass = 'bg-sky-50 text-sky-900 border-sky-200';
    } else if (stage === 'ready') {
      statusLabel = 'Ready';
      statusBadgeClass = 'bg-emerald-50 text-emerald-900 border-emerald-200';
    } else if (stage === 'cancelled') {
      statusLabel = 'Cancelled';
      statusBadgeClass = 'bg-rose-50 text-rose-900 border-rose-200';
    }

    let cardBorderClass = 'border-stone-200';
    if (isHighlighted) {
      cardBorderClass = 'border-teal-700 ring-2 ring-teal-700/20';
    } else if (priority === 'overdue') {
      cardBorderClass = 'border-rose-300';
    } else if (priority === 'urgent' || isNewlyArrived) {
      cardBorderClass = 'border-amber-300';
    }

    const activeItemCount = order.items.filter(i => i.kitchenStatus !== 'cannot_prepare').length;
    const showPerItemToggle = stage === 'preparing' && activeItemCount > 1;

    return (
      <article
        key={order.id}
        ref={el => {
          ticketRefs.current[order.id] = el;
        }}
        className={`bg-white border ${cardBorderClass} rounded-xl flex flex-col justify-between transition-colors`}
      >
        <div>
          {/* Order Header */}
          <div className="px-4 py-3.5 border-b border-stone-100">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight font-mono tabular-nums">
                    {order.orderNumber}
                  </span>
                  {isNewlyArrived && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px] font-bold uppercase tracking-wide">
                      New
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-stone-600">
                  <span className="font-semibold text-stone-800">{destinationLabel}</span>
                  {order.tableId !== 'TAKEAWAY' && order.roundNumber > 1 && (
                    <>
                      <span className="text-stone-300" aria-hidden="true">
                        ·
                      </span>
                      <span>Round {order.roundNumber}</span>
                    </>
                  )}
                  <span className="text-stone-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="tabular-nums" title="Time order was received">
                    {formatOrderTime(order.createdAt)}
                  </span>
                  <span className="text-stone-500 tabular-nums">({elapsed}m ago)</span>
                </div>
              </div>

              <span
                className={`shrink-0 px-2.5 py-1 rounded-md border text-xs font-bold leading-none ${statusBadgeClass}`}
              >
                {statusLabel}
              </span>
            </div>

            {priority !== 'normal' && (
              <div className="mt-2.5">
                {priority === 'overdue' ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold tabular-nums">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                    <span>Overdue · Waiting {elapsed} min</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Urgent Priority · {elapsed} min</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Order-Level Special Instructions */}
          {order.customerNote && (
            <div className="mx-4 mt-3.5 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-900">
                Special Instructions
              </span>
              <p className="mt-0.5 text-sm font-semibold text-stone-900 leading-snug">
                {order.customerNote}
              </p>
            </div>
          )}

          {/* Dishes List */}
          <div className="px-4 py-3.5 divide-y divide-stone-100">
            {order.items.map(item => {
              const isItemReady = item.kitchenStatus === 'ready';
              const isItemRejected = item.kitchenStatus === 'cannot_prepare';
              const itemLockKey = `${order.id}:${item.id}`;
              const isItemUpdating = Boolean(updatingItemIds[itemLockKey]);

              return (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span
                        className={`min-w-[2.5rem] h-8 px-2 rounded-lg text-base font-extrabold font-mono tabular-nums flex items-center justify-center shrink-0 ${
                          isItemRejected
                            ? 'bg-rose-50 text-rose-800 border border-rose-200 line-through'
                            : item.quantity > 1
                            ? 'bg-stone-900 text-white'
                            : 'bg-stone-100 text-stone-900 border border-stone-200'
                        }`}
                        title={`Quantity: ${item.quantity}`}
                      >
                        {item.quantity}×
                      </span>

                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
                          <span
                            className={`text-base sm:text-[17px] font-bold leading-snug ${
                              isItemRejected
                                ? 'line-through text-stone-400'
                                : stage === 'preparing' && isItemReady
                                ? 'text-stone-400 line-through'
                                : 'text-stone-900'
                            }`}
                          >
                            {item.name}
                          </span>
                          {(item.dietType === 'veg' || item.dietType === 'vegan') &&
                            !isItemRejected && (
                              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
                                {item.dietType === 'vegan' ? 'Vegan' : 'Veg'}
                              </span>
                            )}
                        </div>

                        {item.customizations.length > 0 && (
                          <div className="mt-1 text-xs font-medium text-stone-600">
                            {item.customizations.map(c => c.optionName).join(' · ')}
                          </div>
                        )}

                        {item.specialInstructions && (
                          <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                            <span className="text-xs sm:text-sm font-semibold text-amber-950 leading-snug block">
                              Note: {item.specialInstructions}
                            </span>
                          </div>
                        )}

                        {isItemRejected && (
                          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-900">
                            <span>
                              Unavailable{item.rejectionReason ? `: ${item.rejectionReason}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {(stage === 'pending' || stage === 'preparing') && !isItemRejected && (
                      <div className="flex items-center gap-1 shrink-0">
                        {showPerItemToggle && (
                          <button
                            type="button"
                            disabled={isItemUpdating || isUpdating}
                            onClick={() =>
                              handleToggleItemReady(order, item.id, item.kitchenStatus)
                            }
                            className={`min-h-[40px] px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                              isItemReady
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
                            }`}
                            title={
                              isItemReady
                                ? 'Dish ready (tap to undo)'
                                : 'Mark individual dish ready'
                            }
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isItemReady ? 'Done' : 'Check'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isItemUpdating || isUpdating}
                          onClick={() =>
                            setRejectingItem({
                              orderId: order.id,
                              orderNumber: order.orderNumber,
                              itemId: item.id,
                              itemName: item.name
                            })
                          }
                          className="min-h-[40px] min-w-[40px] rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                          title="Mark dish unavailable (out of stock)"
                          aria-label={`Mark ${item.name} unavailable`}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Consistent Card Footer Actions */}
        <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 rounded-b-xl">
          {stage === 'pending' && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleOrderAction(order, 'preparing')}
              className="w-full min-h-[48px] px-4 rounded-xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <span>Start Preparing</span>
              )}
            </button>
          )}

          {stage === 'preparing' && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleOrderAction(order, 'ready')}
              className="w-full min-h-[48px] px-4 rounded-xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Mark as Ready</span>
              )}
            </button>
          )}

          {stage === 'ready' && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Waiting for pickup / service</span>
              </span>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleOrderAction(order, 'served')}
                className="min-h-[44px] px-3.5 rounded-lg bg-white hover:bg-stone-100 active:bg-stone-200 disabled:opacity-60 disabled:cursor-not-allowed text-stone-800 border border-stone-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Collected</span>
                  </>
                )}
              </button>
            </div>
          )}

          {stage === 'cancelled' && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-rose-800">
                Cancelled — Do not prepare
              </span>
              <button
                type="button"
                onClick={() =>
                  setDismissedCancelledIds(prev => {
                    const next = new Set(prev);
                    next.add(order.id);
                    return next;
                  })
                }
                className="min-h-[40px] px-3 rounded-lg bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </article>
    );
  };

  const renderEmptyColumn = (title: string, subtitle: string) => (
    <div className="bg-white/80 border border-dashed border-stone-300 rounded-xl px-4 py-10 text-center">
      <p className="text-sm font-semibold text-stone-700">{title}</p>
      <p className="mt-1 text-xs text-stone-500">{subtitle}</p>
    </div>
  );

  const renderSkeletonCards = (count = 2) => (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white border border-stone-200 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 bg-stone-200 rounded" />
            <div className="h-6 w-20 bg-stone-100 rounded" />
          </div>
          <div className="h-3.5 w-40 bg-stone-100 rounded" />
          <div className="pt-2 space-y-2 border-t border-stone-100">
            <div className="h-6 w-full bg-stone-100 rounded" />
            <div className="h-6 w-4/5 bg-stone-100 rounded" />
          </div>
          <div className="h-11 w-full bg-stone-200 rounded-xl" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-stone-50 text-stone-900 pb-16">
      {/* Top Chef Dashboard Control Bar */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Title & Live Status */}
            <div className="flex items-center justify-between md:justify-start gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-display">
                    Chef Dashboard
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-xs font-medium ${
                      isConnectionLost
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-stone-50 border-stone-200 text-stone-600'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isConnectionLost ? 'bg-rose-600' : 'bg-emerald-600'
                      }`}
                    />
                    <span>{isConnectionLost ? 'Offline' : 'Live Queue'}</span>
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Incoming guest and counter orders sorted oldest-first for smooth preparation
                </p>
              </div>
            </div>

            {/* Search, Audio & Sync Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-initial sm:w-64">
                <label htmlFor="kitchen-search" className="sr-only">
                  Search order number or dish
                </label>
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="kitchen-search"
                  type="text"
                  placeholder="Search order # or dish..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full min-h-[42px] pl-9 pr-8 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-teal-700 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={toggleAudio}
                className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  audioEnabled
                    ? 'bg-teal-50 border-teal-200 text-teal-900'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
                title="Toggle sound chime for new orders"
              >
                {audioEnabled ? (
                  <Volume2 className="w-4 h-4 text-teal-700 shrink-0" />
                ) : (
                  <VolumeX className="w-4 h-4 text-stone-500 shrink-0" />
                )}
                <span>{audioEnabled ? 'Sound On' : 'Sound Off'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSoundSettings(prev => !prev)}
                className="min-h-[42px] min-w-[42px] px-2.5 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Sound volume and tone settings"
                aria-label="Sound settings"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              {onRefreshOrders && (
                <button
                  type="button"
                  disabled={isRefreshing}
                  onClick={handleManualRefresh}
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-60 text-stone-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                  title="Sync orders from server"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Sound Settings Panel */}
          {showSoundSettings && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 max-w-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Order Chime Settings
                </span>
                <button
                  type="button"
                  onClick={() => setShowSoundSettings(false)}
                  className="text-xs font-semibold text-teal-800 hover:text-teal-900 cursor-pointer"
                >
                  Done
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'kitchen_chime', label: 'Dual Chime' },
                  { id: 'restaurant_bell', label: 'Service Bell' },
                  { id: 'urgent_chime', label: 'Triple Tone' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleToneChange(t.id as SoundTone)}
                    className={`min-h-[40px] px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      selectedTone === t.id
                        ? 'bg-teal-700 border-teal-700 text-white'
                        : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-stone-600">
                  <label htmlFor="kitchen-volume-slider">Volume</label>
                  <span className="tabular-nums font-semibold text-stone-900">
                    {Math.round(audioVolume * 100)}%
                  </span>
                </div>
                <input
                  id="kitchen-volume-slider"
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={audioVolume}
                  onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-teal-700 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Mobile / Tablet 3-Section Switcher (< lg) */}
          <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
            <button
              type="button"
              onClick={() => setMobileTab('pending')}
              className={`flex-1 min-h-[46px] px-3 py-2 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                mobileTab === 'pending'
                  ? 'bg-teal-700 border-teal-700 text-white'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              <span>Pending</span>
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-extrabold font-mono tabular-nums ${
                  mobileTab === 'pending'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {stageCounts.pending}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('preparing')}
              className={`flex-1 min-h-[46px] px-3 py-2 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                mobileTab === 'preparing'
                  ? 'bg-teal-700 border-teal-700 text-white'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              <span>Preparing</span>
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-extrabold font-mono tabular-nums ${
                  mobileTab === 'preparing'
                    ? 'bg-white/20 text-white'
                    : 'bg-sky-100 text-sky-900'
                }`}
              >
                {stageCounts.preparing}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('ready')}
              className={`flex-1 min-h-[46px] px-3 py-2 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                mobileTab === 'ready'
                  ? 'bg-teal-700 border-teal-700 text-white'
                  : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              <span>Ready</span>
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-extrabold font-mono tabular-nums ${
                  mobileTab === 'ready'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {stageCounts.ready}
              </span>
            </button>

            {stageCounts.cancelled > 0 && (
              <button
                type="button"
                onClick={() => setMobileTab('cancelled')}
                className={`min-h-[46px] px-3 py-2 rounded-xl border text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  mobileTab === 'cancelled'
                    ? 'bg-teal-700 border-teal-700 text-white'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <span>Cancelled</span>
                <span className="font-mono tabular-nums text-xs font-extrabold">
                  ({stageCounts.cancelled})
                </span>
              </button>
            )}
          </div>

          {/* Desktop View Selector (>= lg): Board View (default) or Focused Section */}
          <div className="hidden lg:flex items-center justify-between gap-4 pt-2 border-t border-stone-100">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDesktopTab('board')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  desktopTab === 'board'
                    ? 'bg-teal-700 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                All 3 Sections
              </button>

              <button
                type="button"
                onClick={() => setDesktopTab('pending')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                  desktopTab === 'pending'
                    ? 'bg-teal-700 text-white'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>1. Pending</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-extrabold font-mono tabular-nums ${
                    desktopTab === 'pending'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-50 text-amber-900 border border-amber-200'
                  }`}
                >
                  {stageCounts.pending}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDesktopTab('preparing')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                  desktopTab === 'preparing'
                    ? 'bg-teal-700 text-white'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>2. Preparing</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-extrabold font-mono tabular-nums ${
                    desktopTab === 'preparing'
                      ? 'bg-white/20 text-white'
                      : 'bg-sky-50 text-sky-900 border border-sky-200'
                  }`}
                >
                  {stageCounts.preparing}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDesktopTab('ready')}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                  desktopTab === 'ready'
                    ? 'bg-teal-700 text-white'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>3. Ready</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-extrabold font-mono tabular-nums ${
                    desktopTab === 'ready'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  }`}
                >
                  {stageCounts.ready}
                </span>
              </button>

              {stageCounts.cancelled > 0 && (
                <button
                  type="button"
                  onClick={() => setDesktopTab('cancelled')}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                    desktopTab === 'cancelled'
                      ? 'bg-teal-700 text-white'
                      : 'bg-rose-50 border border-rose-200 text-rose-900 hover:bg-rose-100/70'
                  }`}
                >
                  <span>Cancelled</span>
                  <span className="font-mono tabular-nums font-extrabold">
                    ({stageCounts.cancelled})
                  </span>
                </button>
              )}
            </div>

            {searchQuery && (
              <span className="text-xs font-medium text-stone-600">
                Showing results for <strong className="text-stone-900">&ldquo;{searchQuery}&rdquo;</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-4">
        {isConnectionLost && (
          <div
            role="alert"
            className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-900"
          >
            <div className="flex items-start sm:items-center gap-2.5">
              <WifiOff className="w-5 h-5 text-rose-700 shrink-0 mt-0.5 sm:mt-0" />
              <div className="text-sm">
                <span className="font-bold">Live connection interrupted. </span>
                <span>Reconnecting automatically — incoming orders may be delayed.</span>
              </div>
            </div>
            {onRefreshOrders && (
              <button
                type="button"
                disabled={isRefreshing}
                onClick={handleManualRefresh}
                className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-white hover:bg-rose-100/50 border border-rose-300 text-rose-900 text-xs font-bold whitespace-nowrap cursor-pointer shrink-0"
              >
                {isRefreshing ? 'Syncing...' : 'Retry Sync Now'}
              </button>
            )}
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-rose-900"
          >
            <div className="flex items-center gap-2.5 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="min-h-[36px] min-w-[36px] rounded-lg text-rose-700 hover:bg-rose-100 flex items-center justify-center cursor-pointer"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <KitchenOrderAlert
          notifications={incomingAlerts}
          onDismiss={id => onDismissAlert?.(id)}
          onAcknowledge={handleAlertStartPreparing}
          onFocusTicket={focusTicket}
        />

        {/* MOBILE / PORTRAIT TABLET SINGLE-SECTION VIEW (< lg) */}
        <div className="lg:hidden space-y-3">
          {isLoadingOrders ? (
            renderSkeletonCards(3)
          ) : mobileTab === 'pending' ? (
            pendingOrders.length > 0 ? (
              pendingOrders.map(renderOrderCard)
            ) : (
              renderEmptyColumn(
                searchQuery ? 'No matching pending orders' : 'No pending orders',
                searchQuery
                  ? 'Clear search to see all waiting orders.'
                  : 'New incoming orders will appear here automatically.'
              )
            )
          ) : mobileTab === 'preparing' ? (
            preparingOrders.length > 0 ? (
              preparingOrders.map(renderOrderCard)
            ) : (
              renderEmptyColumn(
                searchQuery ? 'No matching orders in preparation' : 'No dishes currently preparing',
                'Tap "Start Preparing" on a pending order to move it here.'
              )
            )
          ) : mobileTab === 'ready' ? (
            readyOrders.length > 0 ? (
              readyOrders.map(renderOrderCard)
            ) : (
              renderEmptyColumn(
                searchQuery ? 'No matching ready orders' : 'No completed orders waiting',
                'Dishes marked ready will wait here until collected.'
              )
            )
          ) : cancelledOrders.length > 0 ? (
            cancelledOrders.map(renderOrderCard)
          ) : (
            renderEmptyColumn('No cancelled orders', 'Active cancelled notices have been cleared.')
          )}
        </div>

        {/* DESKTOP VIEW (>= lg): 3-COLUMN WORKFLOW BOARD OR FOCUSED SECTION */}
        <div className="hidden lg:block">
          {desktopTab === 'board' ? (
            <div className="grid grid-cols-3 gap-5 items-start">
              {/* Column 1: Pending */}
              <section aria-label="Pending Orders" className="space-y-3">
                <div className="bg-white border border-stone-200 rounded-xl px-4 py-3.5 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-stone-900 font-display">1. Pending</h2>
                    <p className="text-xs text-stone-500">Waiting to be prepared</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm font-extrabold font-mono tabular-nums">
                    {pendingOrders.length}
                  </span>
                </div>

                {isLoadingOrders ? (
                  renderSkeletonCards(2)
                ) : pendingOrders.length > 0 ? (
                  <div className="space-y-3">{pendingOrders.map(renderOrderCard)}</div>
                ) : (
                  renderEmptyColumn(
                    searchQuery ? 'No matching pending orders' : 'No pending orders',
                    'Incoming orders appear here.'
                  )
                )}
              </section>

              {/* Column 2: Preparing */}
              <section aria-label="Preparing Orders" className="space-y-3">
                <div className="bg-white border border-stone-200 rounded-xl px-4 py-3.5 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-stone-900 font-display">
                      2. Preparing
                    </h2>
                    <p className="text-xs text-stone-500">Currently cooking</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-sm font-extrabold font-mono tabular-nums">
                    {preparingOrders.length}
                  </span>
                </div>

                {isLoadingOrders ? (
                  renderSkeletonCards(2)
                ) : preparingOrders.length > 0 ? (
                  <div className="space-y-3">{preparingOrders.map(renderOrderCard)}</div>
                ) : (
                  renderEmptyColumn(
                    searchQuery ? 'No matching preparing orders' : 'Nothing in preparation',
                    'Start a pending order to move it here.'
                  )
                )}
              </section>

              {/* Column 3: Ready */}
              <section aria-label="Ready Orders" className="space-y-3">
                <div className="bg-white border border-stone-200 rounded-xl px-4 py-3.5 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-stone-900 font-display">3. Ready</h2>
                    <p className="text-xs text-stone-500">Waiting to be served or collected</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-extrabold font-mono tabular-nums">
                    {readyOrders.length}
                  </span>
                </div>

                {isLoadingOrders ? (
                  renderSkeletonCards(1)
                ) : readyOrders.length > 0 ? (
                  <div className="space-y-3">{readyOrders.map(renderOrderCard)}</div>
                ) : (
                  renderEmptyColumn(
                    searchQuery ? 'No matching ready orders' : 'No orders waiting pickup',
                    'Ready dishes appear here until collected.'
                  )
                )}
              </section>
            </div>
          ) : (
            <div>
              {isLoadingOrders ? (
                <div className="grid grid-cols-3 gap-4">{renderSkeletonCards(3)}</div>
              ) : (
                (() => {
                  const activeList =
                    desktopTab === 'pending'
                      ? pendingOrders
                      : desktopTab === 'preparing'
                      ? preparingOrders
                      : desktopTab === 'ready'
                      ? readyOrders
                      : cancelledOrders;

                  if (activeList.length === 0) {
                    return (
                      <div className="max-w-md mx-auto pt-6">
                        {renderEmptyColumn(
                          searchQuery
                            ? `No orders matching "${searchQuery}"`
                            : `No ${desktopTab} orders`,
                          searchQuery
                            ? 'Clear the search filter or switch sections.'
                            : 'Switch to All 3 Sections to view the full kitchen workflow.'
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                      {activeList.map(renderOrderCard)}
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>
      </main>

      {/* Non-Blocking Confirmation Toast */}
      {confirmationToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-stone-900 text-white border border-stone-800 rounded-xl px-4 py-3 shadow-md flex items-center gap-2.5 text-sm font-medium max-w-sm"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{confirmationToast.message}</span>
        </div>
      )}

      {/* Modal for Marking Dish Unavailable */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unavailable-dialog-title"
            className="bg-white border border-stone-200 rounded-2xl max-w-sm w-full p-5 sm:p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center gap-2.5 text-rose-800">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-700" />
              <h3
                id="unavailable-dialog-title"
                className="text-base font-bold text-stone-900 font-display"
              >
                Mark Dish Unavailable
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              Mark <strong className="text-stone-900">{rejectingItem.itemName}</strong> on{' '}
              <strong className="text-stone-900 font-mono tabular-nums">
                {rejectingItem.orderNumber}
              </strong>{' '}
              as unavailable? Counter staff will be notified and the bill adjusted automatically.
            </p>

            <div>
              <label
                htmlFor="item-unavailable-reason"
                className="text-xs font-bold text-stone-700 block mb-1.5"
              >
                Reason (Optional)
              </label>
              <input
                id="item-unavailable-reason"
                type="text"
                placeholder="e.g. Ingredient out of stock"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="w-full min-h-[44px] text-sm px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-teal-700 transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setRejectingItem(null);
                  setRejectionReason('');
                }}
                className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors cursor-pointer"
              >
                Confirm Unavailable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
