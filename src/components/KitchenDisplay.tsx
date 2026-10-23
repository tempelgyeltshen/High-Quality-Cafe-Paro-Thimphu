import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  Volume2,
  VolumeX,
  ChefHat,
  Filter,
  Check,
  XCircle,
  Sparkles,
  Flame,
  ArrowRight,
  Bell,
  Sliders,
  Play,
  Layers,
  Search,
  X
} from 'lucide-react';
import { OrderRound, OrderItemKitchenStatus, OrderStatus } from '../types/index.ts';
import { soundService, SoundTone } from '../lib/audio.ts';
import { KitchenOrderAlert, AlertOrderNotification } from './KitchenOrderAlert.tsx';

export type KitchenFilterMode = 'all_active' | 'new' | 'in_progress' | 'ready' | 'all';

interface KitchenDisplayProps {
  orders: OrderRound[];
  onUpdateItemStatus: (orderId: string, itemId: string, status: OrderItemKitchenStatus, reason?: string) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  incomingAlerts?: AlertOrderNotification[];
  onDismissAlert?: (id: string) => void;
  onSimulateOrder?: () => void;
}

export const KitchenDisplay: React.FC<KitchenDisplayProps> = ({
  orders,
  onUpdateItemStatus,
  onUpdateOrderStatus,
  incomingAlerts = [],
  onDismissAlert,
  onSimulateOrder
}) => {
  const [filter, setFilter] = useState<KitchenFilterMode>('all_active');
  const [searchQuery, setSearchQuery] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(soundService.isEnabled());
  const [selectedTone, setSelectedTone] = useState<SoundTone>(soundService.getTone());
  const [audioVolume, setAudioVolume] = useState<number>(soundService.getVolume());
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [rejectingItem, setRejectingItem] = useState<{ orderId: string; itemId: string; itemName: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

  // References for ticket card scrolling
  const ticketRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Tick every 10 seconds to update elapsed timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

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

  const calculateElapsedMinutes = (isoString: string) => {
    const diffMs = currentTime - new Date(isoString).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  // Real-time counts for kitchen workflow stages
  const orderCounts = useMemo(() => {
    const uncancelled = orders.filter(o => o.status !== 'cancelled');
    const allActive = uncancelled.filter(o => o.status !== 'served').length;
    const newOrders = uncancelled.filter(o => o.status === 'submitted').length;
    const inProgress = uncancelled.filter(o => o.status === 'preparing' || o.status === 'acknowledged').length;
    const readyOrders = uncancelled.filter(o => o.status === 'ready').length;
    const allOrders = uncancelled.length;
    return { allActive, newOrders, inProgress, readyOrders, allOrders };
  }, [orders]);

  // Filter orders based on selected workflow mode & search query
  const filteredOrders = useMemo(() => {
    return orders
      .filter(ord => {
        if (ord.status === 'cancelled') return false;
        if (filter === 'all_active') return ord.status !== 'served';
        if (filter === 'new') return ord.status === 'submitted';
        if (filter === 'in_progress') return ord.status === 'preparing' || ord.status === 'acknowledged';
        if (filter === 'ready') return ord.status === 'ready';
        return true; // 'all'
      })
      .filter(ord => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchesTable = ord.tableId.toLowerCase().includes(q);
        const matchesNum = ord.orderNumber.toLowerCase().includes(q);
        const matchesDish = ord.items.some(it => it.name.toLowerCase().includes(q));
        const matchesNote = ord.customerNote?.toLowerCase().includes(q);
        return matchesTable || matchesNum || matchesDish || matchesNote;
      });
  }, [orders, filter, searchQuery]);

  const handleConfirmRejection = async () => {
    if (!rejectingItem) return;
    const reason = rejectionReason.trim() || 'Ingredient out of stock';
    await onUpdateItemStatus(rejectingItem.orderId, rejectingItem.itemId, 'cannot_prepare', reason);
    setRejectingItem(null);
    setRejectionReason('');
  };

  const focusTicket = (orderId: string) => {
    setHighlightedOrderId(orderId);
    const targetOrder = orders.find(o => o.id === orderId);
    if (targetOrder) {
      if (targetOrder.status === 'submitted' && filter !== 'all_active' && filter !== 'new') {
        setFilter('new');
      } else if ((targetOrder.status === 'preparing' || targetOrder.status === 'acknowledged') && filter !== 'all_active' && filter !== 'in_progress') {
        setFilter('in_progress');
      } else if (targetOrder.status === 'ready' && filter !== 'all_active' && filter !== 'ready') {
        setFilter('ready');
      } else if (filter !== 'all_active' && filter !== 'all') {
        setFilter('all_active');
      }
    }
    setTimeout(() => {
      const el = ticketRefs.current[orderId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    // Fade highlight after 8 seconds
    setTimeout(() => {
      setHighlightedOrderId(current => current === orderId ? null : current);
    }, 8000);
  };

  const handleAcknowledgeAndStart = async (orderId: string) => {
    await onUpdateOrderStatus(orderId, 'preparing');
    focusTicket(orderId);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-4 sm:p-6 pb-20 relative">
      {/* Prominent Non-Intrusive Floating Order Alert */}
      <KitchenOrderAlert
        notifications={incomingAlerts}
        onDismiss={(id) => onDismissAlert?.(id)}
        onAcknowledge={handleAcknowledgeAndStart}
        onFocusTicket={focusTicket}
      />

      {/* KDS Control Header */}
      <div className="max-w-7xl mx-auto space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
                  Kitchen Display System (KDS)
                </h1>
                {/* Live Real-Time Pulse Indicator */}
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  REAL-TIME SYNC ACTIVE
                </span>
              </div>
              <p className="text-xs text-stone-400">
                High Quality Cafe 24/7 Live Order Preparation Queue · Thimphu
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Audio Alert Button & State */}
            <button
              onClick={toggleAudio}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                audioEnabled
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-sm'
                  : 'bg-stone-900 border-stone-800 text-stone-400'
              }`}
              title="Toggle audio alert chime for incoming customer orders"
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-stone-500" />}
              <span>{audioEnabled ? 'Sound On' : 'Sound Muted'}</span>
            </button>

            {/* Sound Config Dropdown Toggle */}
            <button
              onClick={() => setShowSoundSettings(!showSoundSettings)}
              className="px-2.5 py-1.5 rounded-xl text-xs text-stone-300 bg-stone-900 border border-stone-800 hover:bg-stone-800 transition-colors flex items-center gap-1.5"
              title="Configure chime tone and volume"
            >
              <Sliders className="w-3.5 h-3.5 text-stone-400" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            {/* Test Sound & Alert Button */}
            <button
              onClick={() => {
                soundService.playNewOrderChime();
                if (onSimulateOrder) onSimulateOrder();
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-950/50 border border-amber-800/80 hover:bg-amber-900/50 transition-colors flex items-center gap-1.5"
              title="Simulate incoming order and test audio/visual alert"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>Test Alert</span>
            </button>
          </div>
        </div>

        {/* Audio Configuration Panel (collapsible) */}
        {showSoundSettings && (
          <div className="bg-stone-900/90 border border-stone-800 p-4 rounded-2xl shadow-xl max-w-lg space-y-3 animate-in fade-in-50 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                Kitchen Sound & Alert Settings
              </span>
              <button
                onClick={() => setShowSoundSettings(false)}
                className="text-stone-500 hover:text-stone-300 text-xs"
              >
                Done
              </button>
            </div>

            {/* Tone selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-stone-400">
                Alert Tone Profile
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'kitchen_chime', label: 'Dual Chime' },
                  { id: 'restaurant_bell', label: 'Brass Bell' },
                  { id: 'urgent_chime', label: 'Ascending Fanfare' },
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleToneChange(t.id as SoundTone)}
                    className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-colors ${
                      selectedTone === t.id
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300 font-bold'
                        : 'border-stone-800 bg-stone-950 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Volume range */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-stone-400">
                <span>Alert Volume</span>
                <span className="font-mono text-stone-200">{Math.round(audioVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={audioVolume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-stone-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Quick Workflow Metric Cards (Clickable Quick Filters) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* All Active Orders Card */}
          <button
            type="button"
            onClick={() => setFilter('all_active')}
            className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              filter === 'all_active'
                ? 'bg-amber-500/15 border-amber-500/70 ring-2 ring-amber-500/30 shadow-lg'
                : 'bg-stone-900/90 border-stone-800 hover:border-stone-700 hover:bg-stone-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                All Active Orders
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                filter === 'all_active' ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-800 text-amber-400'
              }`}>
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                {orderCounts.allActive}
              </span>
              <span className="text-[10px] text-stone-400">
                Total queue
              </span>
            </div>
          </button>

          {/* New Orders Card */}
          <button
            type="button"
            onClick={() => setFilter('new')}
            className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
              filter === 'new'
                ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                : orderCounts.newOrders > 0
                ? 'bg-amber-950/30 border-amber-500/50 hover:bg-amber-950/40'
                : 'bg-stone-900/90 border-stone-800 hover:border-stone-700 hover:bg-stone-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                {orderCounts.newOrders > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
                New Orders
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                filter === 'new'
                  ? 'bg-amber-400 text-stone-950 font-bold'
                  : orderCounts.newOrders > 0
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                  : 'bg-stone-800 text-stone-400'
              }`}>
                <Bell className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className={`text-2xl sm:text-3xl font-extrabold font-mono ${
                orderCounts.newOrders > 0 ? 'text-amber-300' : 'text-stone-300'
              }`}>
                {orderCounts.newOrders}
              </span>
              <span className="text-[10px] text-amber-400/80">
                {orderCounts.newOrders === 1 ? 'Needs ack' : 'Need ack'}
              </span>
            </div>
          </button>

          {/* In-Progress Orders Card */}
          <button
            type="button"
            onClick={() => setFilter('in_progress')}
            className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              filter === 'in_progress'
                ? 'bg-amber-500/15 border-amber-500/70 ring-2 ring-amber-500/30 shadow-lg'
                : 'bg-stone-900/90 border-stone-800 hover:border-stone-700 hover:bg-stone-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                In-Progress Orders
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                filter === 'in_progress' ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-800 text-amber-400'
              }`}>
                <Flame className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                {orderCounts.inProgress}
              </span>
              <span className="text-[10px] text-stone-400">
                Cooking fresh
              </span>
            </div>
          </button>

          {/* Ready to Serve Card */}
          <button
            type="button"
            onClick={() => setFilter('ready')}
            className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              filter === 'ready'
                ? 'bg-emerald-500/15 border-emerald-500/70 ring-2 ring-emerald-500/30 shadow-lg'
                : 'bg-stone-900/90 border-stone-800 hover:border-stone-700 hover:bg-stone-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Ready to Serve
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                filter === 'ready' ? 'bg-emerald-500 text-stone-950 font-bold' : 'bg-stone-800 text-emerald-400'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400">
                {orderCounts.readyOrders}
              </span>
              <span className="text-[10px] text-stone-400">
                To table
              </span>
            </div>
          </button>
        </div>

        {/* Filter Segmented Controls & Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-stone-900/80 p-2 sm:p-2.5 rounded-2xl border border-stone-800">
          {/* Segmented Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {/* 1. All Active Orders */}
            <button
              onClick={() => setFilter('all_active')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 min-h-[38px] ${
                filter === 'all_active'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-stone-800/80 text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Active Orders</span>
              <span className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                filter === 'all_active' ? 'bg-stone-950 text-amber-300' : 'bg-stone-900 text-stone-400'
              }`}>
                {orderCounts.allActive}
              </span>
            </button>

            {/* 2. New Orders */}
            <button
              onClick={() => setFilter('new')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 min-h-[38px] ${
                filter === 'new'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                  : orderCounts.newOrders > 0
                  ? 'bg-amber-950/60 text-amber-300 border border-amber-500/50 hover:bg-amber-900/50'
                  : 'bg-stone-800/80 text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>New Orders</span>
              <span className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                filter === 'new'
                  ? 'bg-stone-950 text-amber-300'
                  : orderCounts.newOrders > 0
                  ? 'bg-amber-500 text-stone-950 animate-pulse'
                  : 'bg-stone-900 text-stone-400'
              }`}>
                {orderCounts.newOrders}
              </span>
            </button>

            {/* 3. In-Progress Orders */}
            <button
              onClick={() => setFilter('in_progress')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 min-h-[38px] ${
                filter === 'in_progress'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-stone-800/80 text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>In-Progress Orders</span>
              <span className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                filter === 'in_progress' ? 'bg-stone-950 text-amber-300' : 'bg-stone-900 text-stone-400'
              }`}>
                {orderCounts.inProgress}
              </span>
            </button>

            {/* 4. Ready to Serve */}
            <button
              onClick={() => setFilter('ready')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 min-h-[38px] ${
                filter === 'ready'
                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                  : 'bg-stone-800/80 text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ready</span>
              <span className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                filter === 'ready' ? 'bg-stone-950 text-emerald-300' : 'bg-stone-900 text-stone-400'
              }`}>
                {orderCounts.readyOrders}
              </span>
            </button>

            {/* 5. All Today */}
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 min-h-[38px] ${
                filter === 'all'
                  ? 'bg-stone-200 text-stone-950 font-bold shadow-xs'
                  : 'bg-stone-800/80 text-stone-400 hover:text-white hover:bg-stone-800'
              }`}
            >
              <span>All Today</span>
              <span className="font-mono text-[10px] text-stone-400">
                ({orderCounts.allOrders})
              </span>
            </button>
          </div>

          {/* Quick Search Input for peak rush table lookup */}
          <div className="relative shrink-0 md:w-64">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search table or dish (e.g. T01)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-stone-950 border border-stone-800 rounded-xl text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-0.5"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tickets Queue Grid */}
      <main className="max-w-7xl mx-auto">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-stone-900/60 rounded-2xl border border-stone-800 max-w-md mx-auto p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-800 text-stone-400 flex items-center justify-center mx-auto">
              {filter === 'new' ? (
                <Bell className="w-6 h-6 text-amber-400" />
              ) : filter === 'in_progress' ? (
                <Flame className="w-6 h-6 text-amber-400" />
              ) : filter === 'ready' ? (
                <Sparkles className="w-6 h-6 text-emerald-400" />
              ) : (
                <ChefHat className="w-6 h-6 text-stone-400" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-stone-200">
                {searchQuery
                  ? `No tickets matching "${searchQuery}"`
                  : filter === 'new'
                  ? 'No New Orders Waiting'
                  : filter === 'in_progress'
                  ? 'No In-Progress Orders'
                  : filter === 'ready'
                  ? 'No Orders Ready to Serve'
                  : 'No Active Orders in Kitchen'}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed max-w-xs mx-auto">
                {searchQuery
                  ? 'Try searching with a different table number or dish name.'
                  : filter === 'new'
                  ? 'All incoming customer tickets have been acknowledged.'
                  : filter === 'in_progress'
                  ? 'There are currently no tickets actively cooking. Check New Orders to start preparation.'
                  : filter === 'ready'
                  ? 'All prepared dishes have been delivered to tables.'
                  : 'The kitchen queue is clear! New table QR orders will appear here automatically.'}
              </p>
            </div>

            {/* Quick Context Action */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  Clear Search Filter
                </button>
              ) : filter === 'new' ? (
                <button
                  type="button"
                  onClick={() => setFilter('in_progress')}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>View In-Progress Orders ({orderCounts.inProgress})</span>
                </button>
              ) : filter === 'in_progress' ? (
                <button
                  type="button"
                  onClick={() => setFilter('new')}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>View New Orders ({orderCounts.newOrders})</span>
                </button>
              ) : filter !== 'all_active' ? (
                <button
                  type="button"
                  onClick={() => setFilter('all_active')}
                  className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>View All Active Orders ({orderCounts.allActive})</span>
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map(order => {
              const elapsed = calculateElapsedMinutes(order.createdAt);
              const isHighlighted = highlightedOrderId === order.id;

              // Urgency color coding
              let timerBg = 'bg-stone-800 text-stone-300';
              if (elapsed >= 20) {
                timerBg = 'bg-rose-950/80 text-rose-300 border border-rose-800 animate-pulse';
              } else if (elapsed >= 10) {
                timerBg = 'bg-amber-950/80 text-amber-300 border border-amber-800';
              }

              const isAllReady = order.items.every(i => i.kitchenStatus === 'ready' || i.kitchenStatus === 'cannot_prepare');

              return (
                <div
                  key={order.id}
                  ref={el => { ticketRefs.current[order.id] = el; }}
                  className={`bg-stone-900 border rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between transition-all duration-300 ${
                    isHighlighted
                      ? 'border-amber-400 ring-4 ring-amber-500/40 scale-[1.02] shadow-2xl'
                      : order.status === 'ready'
                      ? 'border-emerald-800/80 ring-1 ring-emerald-500/30'
                      : order.status === 'submitted'
                      ? 'border-amber-500/80 ring-2 ring-amber-500/30'
                      : 'border-stone-800'
                  }`}
                >
                  {/* Ticket Header */}
                  <div>
                    <div className="p-3.5 bg-stone-850 border-b border-stone-800 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-amber-400 font-mono">
                            {order.tableId}
                          </span>
                          <span className="text-xs font-semibold text-stone-300">
                            Round #{order.roundNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400 font-mono">
                          {order.orderNumber}
                        </div>
                      </div>

                      {/* Elapsed Timer */}
                      <div className={`px-2 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-1 ${timerBg}`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{elapsed}m</span>
                      </div>
                    </div>

                    {/* Customer overall note */}
                    {order.customerNote && (
                      <div className="bg-amber-950/40 border-b border-amber-900/40 p-2.5 text-xs text-amber-200 italic">
                        Note: {order.customerNote}
                      </div>
                    )}

                    {/* Ticket Items List */}
                    <div className="p-3.5 space-y-2.5 divide-y divide-stone-800/60">
                      {order.items.map(item => {
                        const isReady = item.kitchenStatus === 'ready';
                        const isRejected = item.kitchenStatus === 'cannot_prepare';
                        const isPrep = item.kitchenStatus === 'preparing';

                        return (
                          <div key={item.id} className="pt-2 first:pt-0 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-sm text-amber-400 font-mono bg-stone-800 px-1.5 py-0.5 rounded">
                                  {item.quantity}x
                                </span>
                                <div>
                                  <span className={`text-xs font-bold leading-snug ${isReady ? 'line-through text-stone-500' : isRejected ? 'text-rose-400 line-through' : 'text-stone-100'}`}>
                                    {item.name}
                                  </span>
                                  {item.dietType === 'veg' && (
                                    <span className="ml-1 text-[10px] text-emerald-400 font-normal">Veg</span>
                                  )}
                                </div>
                              </div>

                              {/* Item status pill / action */}
                              <div className="flex items-center gap-1">
                                {!isReady && !isRejected && (
                                  <>
                                    <button
                                      onClick={() => onUpdateItemStatus(order.id, item.id, isPrep ? 'ready' : 'preparing')}
                                      className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                        isPrep
                                          ? 'bg-amber-600 text-white hover:bg-emerald-600'
                                          : 'bg-stone-800 text-stone-300 hover:bg-amber-600 hover:text-white'
                                      }`}
                                      title={isPrep ? 'Mark as Ready' : 'Start Preparing'}
                                    >
                                      {isPrep ? 'Mark Ready' : 'Start Prep'}
                                    </button>
                                    <button
                                      onClick={() => setRejectingItem({ orderId: order.id, itemId: item.id, itemName: item.name })}
                                      className="p-1 rounded-md text-stone-500 hover:text-rose-400 hover:bg-rose-950/50 transition-colors"
                                      title="Flag: Cannot Prepare"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                {isReady && (
                                  <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" /> Ready
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="text-[11px] font-semibold text-rose-400">
                                    Unavailable
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Customizations Breakdown */}
                            {item.customizations.length > 0 && (
                              <div className="pl-6 text-[11px] space-y-0.5">
                                {item.customizations.map((c, i) => (
                                  <span
                                    key={i}
                                    className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700/80 font-mono"
                                  >
                                    {c.optionName}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Item special instruction */}
                            {item.specialInstructions && (
                              <div className="pl-6 text-[11px] text-amber-300 italic">
                                * {item.specialInstructions}
                              </div>
                            )}

                            {item.rejectionReason && (
                              <div className="pl-6 text-[11px] text-rose-400">
                                Reason: {item.rejectionReason}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ticket Bottom Actions */}
                  <div className="p-3 bg-stone-850 border-t border-stone-800 flex items-center justify-between gap-2">
                    {order.status === 'submitted' && (
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'preparing')}
                        className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>Acknowledge Ticket</span>
                      </button>
                    )}

                    {order.status === 'preparing' && (
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'ready')}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Mark Whole Ticket Ready</span>
                      </button>
                    )}

                    {order.status === 'ready' && (
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'served')}
                        className="w-full py-2 px-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Served / Clear Ticket</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Flag Item Cannot Prepare Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold">Cannot Prepare Item</h3>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              Flag <strong>{rejectingItem.itemName}</strong> as unavailable. This will notify the cashier and automatically deduct the cost from the customer's bill.
            </p>
            <div>
              <label className="text-[11px] font-semibold text-stone-400 block mb-1">
                Reason for Kitchen & Counter
              </label>
              <input
                type="text"
                placeholder="e.g. Out of cheese, kitchen appliance down..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingItem(null)}
                className="px-3 py-1.5 text-xs text-stone-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRejection}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
              >
                Confirm Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
