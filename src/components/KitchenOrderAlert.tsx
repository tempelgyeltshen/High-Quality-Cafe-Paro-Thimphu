import React, { useState, useEffect } from 'react';
import {
  Bell,
  ChefHat,
  X,
  Volume2,
  VolumeX,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { OrderRound } from '../types/index.ts';
import { soundService } from '../lib/audio.ts';

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
  const [audioEnabled, setAudioEnabled] = useState(soundService.isEnabled());
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);

  // Focus on the newest notification
  const currentNotification = notifications[0] || null;

  useEffect(() => {
    if (!currentNotification) return;

    // Reset progress
    setProgress(100);
    const duration = 12000; // 12 seconds auto-dismiss
    const intervalTime = 100;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      if (!isPaused) {
        setProgress(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            onDismiss(currentNotification.id);
            return 0;
          }
          return prev - step;
        });
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentNotification, isPaused, onDismiss]);

  if (!currentNotification) return null;

  const { order } = currentNotification;
  const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);

  const toggleSound = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    soundService.setEnabled(next);
    if (next) soundService.playNewOrderChime();
  };

  return (
    <aside
      aria-label="New Kitchen Order Alert"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="fixed top-20 right-4 sm:right-6 z-50 max-w-md w-full animate-in slide-in-from-top-4 duration-300 pointer-events-auto"
    >
      <div className="bg-stone-900/98 backdrop-blur-md border-2 border-amber-500 rounded-2xl shadow-2xl overflow-hidden ring-4 ring-amber-500/20 text-stone-100">
        {/* Progress Bar for Auto-Dismiss */}
        <div className="h-1.5 w-full bg-stone-800">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Alert Content Header */}
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold shadow-md animate-pulse">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-extrabold uppercase tracking-widest text-amber-400">
                    NEW ORDER RECEIVED
                  </span>
                  {notifications.length > 1 && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">
                      +{notifications.length - 1} more
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-xl font-black tracking-tight text-white font-mono">
                    {order.tableId}
                  </h3>
                  <span className="text-xs text-stone-400 font-medium">
                    Round #{order.roundNumber} ({order.orderNumber})
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions (Sound + Dismiss) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={toggleSound}
                className={`p-1.5 rounded-lg border transition-colors ${
                  audioEnabled
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                    : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200'
                }`}
                title={audioEnabled ? 'Sound alerts active. Click to mute' : 'Sound muted. Click to enable sound'}
              >
                {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => onDismiss(currentNotification.id)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
                title="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Dishes Items Summary List */}
          <div className="bg-stone-950/80 rounded-xl p-3 border border-stone-800/80 space-y-1.5 max-h-36 overflow-y-auto">
            <div className="text-[11px] font-semibold text-stone-400 flex items-center justify-between">
              <span>{itemCount} Item{itemCount > 1 ? 's' : ''} to prepare:</span>
              <span className="text-amber-400/90 font-mono text-[10px] uppercase tracking-wider">Awaiting Prep</span>
            </div>

            <div className="space-y-1 divide-y divide-stone-800/60 text-xs">
              {order.items.map(item => (
                <div key={item.id} className="pt-1.5 first:pt-0 flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-amber-400 mr-1.5">
                      {item.quantity}x
                    </span>
                    <span className="font-semibold text-stone-100">{item.name}</span>
                    {item.customizations.length > 0 && (
                      <span className="text-[11px] text-stone-400 ml-1.5">
                        ({item.customizations.map(c => c.optionName).join(', ')})
                      </span>
                    )}
                    {item.specialInstructions && (
                      <div className="text-[11px] text-amber-300 italic pl-5">
                        * {item.specialInstructions}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {order.customerNote && (
              <div className="mt-2 text-[11px] text-amber-200/90 bg-amber-950/40 border border-amber-900/50 p-2 rounded italic">
                Note: "{order.customerNote}"
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onAcknowledge(order.id);
                onDismiss(currentNotification.id);
              }}
              className="py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5"
            >
              <ChefHat className="w-4 h-4" />
              <span>Acknowledge & Start</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onFocusTicket(order.id);
                onDismiss(currentNotification.id);
              }}
              className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs rounded-xl border border-stone-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <span>View in Grid</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
