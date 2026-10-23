import React from 'react';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Sparkles,
  Check,
  Flame,
  Utensils,
  AlertCircle
} from 'lucide-react';
import { OrderStatus } from '../types/index.ts';

interface OrderStatusTrackerProps {
  status: OrderStatus;
  orderNumber?: string;
  orderTime?: string;
  variant?: 'full' | 'compact' | 'mini';
  className?: string;
}

export type ProgressStepId = 'placed' | 'preparing' | 'ready';

interface StepDefinition {
  id: ProgressStepId;
  label: string;
  shortLabel: string;
  description: string;
  activeDescription: string;
}

const STEPS: StepDefinition[] = [
  {
    id: 'placed',
    label: 'Order Placed',
    shortLabel: 'Placed',
    description: 'Ticket received by kitchen queue',
    activeDescription: 'Received & queued for kitchen'
  },
  {
    id: 'preparing',
    label: 'Preparing',
    shortLabel: 'Preparing',
    description: 'Chef is cooking your dishes fresh',
    activeDescription: 'Dishes currently on the stove / cooking'
  },
  {
    id: 'ready',
    label: 'Ready to Serve',
    shortLabel: 'Ready',
    description: 'Plated & being delivered to your table',
    activeDescription: 'Dishes ready · Serving now'
  }
];

export const OrderStatusTracker: React.FC<OrderStatusTrackerProps> = ({
  status,
  orderNumber,
  orderTime,
  variant = 'full',
  className = ''
}) => {
  // Determine current active step (0: Placed, 1: Preparing, 2: Ready, 3: Served)
  const getStepIndex = (st: OrderStatus): number => {
    switch (st) {
      case 'submitted':
        return 0; // Placed
      case 'acknowledged':
      case 'preparing':
        return 1; // Preparing
      case 'ready':
        return 2; // Ready
      case 'served':
        return 3; // Fully Served
      case 'cancelled':
        return -1; // Cancelled
      default:
        return 0;
    }
  };

  const currentStepIdx = getStepIndex(status);
  const isCancelled = status === 'cancelled';
  const isServed = status === 'served';

  // Compute progress line percentage (0% to 100%)
  const getProgressPercentage = (): number => {
    if (isCancelled) return 0;
    if (isServed) return 100;
    if (currentStepIdx === 0) return 15; // At Placed
    if (currentStepIdx === 1) return 50; // At Preparing
    if (currentStepIdx === 2) return 90; // At Ready
    return 0;
  };

  const progressPercent = getProgressPercentage();

  if (isCancelled) {
    return (
      <div className={`bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-3 text-rose-800 ${className}`}>
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide">Order Cancelled</p>
          <p className="text-[11px] text-rose-600">This order round was voided or cancelled by staff.</p>
        </div>
      </div>
    );
  }

  // Mini variant (e.g. for inside table summaries or list cards)
  if (variant === 'mini') {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-stone-700">Status</span>
          <span className="font-bold text-amber-700 capitalize">
            {isServed ? 'Served' : currentStepIdx === 2 ? 'Ready' : currentStepIdx === 1 ? 'Preparing' : 'Placed'}
          </span>
        </div>
        <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200">
          <div
            className={`h-full transition-all duration-700 rounded-full ${
              isServed
                ? 'bg-stone-700'
                : currentStepIdx === 2
                ? 'bg-emerald-500'
                : currentStepIdx === 1
                ? 'bg-amber-500 animate-pulse'
                : 'bg-blue-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-stone-400 font-medium">
          <span className={currentStepIdx >= 0 ? 'text-stone-800 font-semibold' : ''}>Placed</span>
          <span className={currentStepIdx >= 1 ? 'text-amber-800 font-semibold' : ''}>Preparing</span>
          <span className={currentStepIdx >= 2 ? 'text-emerald-800 font-semibold' : ''}>Ready</span>
        </div>
      </div>
    );
  }

  // Compact variant (e.g. for customer menu banner / notification)
  if (variant === 'compact') {
    return (
      <div className={`bg-stone-900/90 text-stone-100 border border-amber-500/30 rounded-2xl p-4 shadow-lg backdrop-blur-sm ${className}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Live Order Progress
            </span>
            {orderNumber && (
              <span className="text-xs font-mono font-bold text-stone-200 bg-stone-800 px-2 py-0.5 rounded">
                {orderNumber}
              </span>
            )}
          </div>
          {orderTime && (
            <span className="text-[11px] text-stone-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-stone-500" />
              Placed at {orderTime}
            </span>
          )}
        </div>

        {/* 3-Step Visual Tracker Bar */}
        <div className="pt-3 pb-1 px-1 sm:px-6">
          <div className="relative">
            {/* Background Track Line */}
            <div className="absolute top-1/2 left-3 right-3 sm:left-4 sm:right-4 -translate-y-1/2 h-1 sm:h-1.5 bg-stone-800 rounded-full z-0" />

            {/* Filled Progress Line */}
            <div
              className="absolute top-1/2 left-3 -translate-y-1/2 h-1 sm:h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 rounded-full z-0 transition-all duration-700 ease-out"
              style={{ width: `calc((100% - 1.5rem) * ${progressPercent / 100})` }}
            />

            {/* Steps Nodes */}
            <div className="relative z-10 flex justify-between items-center">
              {STEPS.map((step, idx) => {
                const isPassed = isServed || currentStepIdx > idx;
                const isCurrent = !isServed && currentStepIdx === idx;
                const isPending = !isServed && currentStepIdx < idx;

                return (
                  <div key={step.id} className="flex flex-col items-center">
                    {/* Node Circle */}
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold transition-all duration-300 ${
                        isPassed
                          ? 'bg-emerald-500 text-stone-950 shadow-md shadow-emerald-500/30'
                          : isCurrent
                          ? 'bg-amber-500 text-stone-950 ring-2 sm:ring-4 ring-amber-400/30 shadow-lg shadow-amber-500/40 animate-pulse'
                          : 'bg-stone-800 text-stone-400 border border-stone-700'
                      }`}
                    >
                      {isPassed ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : isCurrent ? (
                        idx === 0 ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : idx === 1 ? (
                          <Flame className="w-3.5 h-3.5" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>

                    {/* Step Label */}
                    <span
                      className={`mt-1.5 text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                        isCurrent
                          ? 'text-amber-300 font-bold'
                          : isPassed
                          ? 'text-emerald-400'
                          : 'text-stone-400'
                      }`}
                    >
                      {step.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full variant (Default for PreviousOrdersView cards and Confirmation Modal)
  return (
    <div className={`bg-stone-50 border border-stone-200/90 rounded-2xl p-3 sm:p-5 space-y-3 sm:space-y-4 shadow-xs ${className}`}>
      {/* Header with Title and Current State Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/70 pb-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              Visual Progress Tracker
            </span>
            {isServed && (
              <span className="bg-stone-200 text-stone-800 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">
                Completed
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-stone-600 font-medium">
            {isServed
              ? 'All dishes delivered to your table. Enjoy your meal!'
              : STEPS[currentStepIdx]?.activeDescription || 'Order is being processed'}
          </p>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-1.5">
          {isServed ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-stone-200 text-stone-800">
              <Utensils className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Served to Table
            </span>
          ) : currentStepIdx === 2 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 ring-2 ring-emerald-300/40">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />
              Ready to Serve
            </span>
          ) : currentStepIdx === 1 ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 ring-2 ring-amber-300/40 animate-pulse">
              <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />
              Cooking in Kitchen
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600" />
              Order Placed
            </span>
          )}
        </div>
      </div>

      {/* Visual Stepper with Progress Bar */}
      <div className="pt-2 pb-1 px-1 sm:px-6">
        <div className="relative">
          {/* Background Connecting Bar */}
          <div className="absolute top-4 sm:top-5 left-4 right-4 sm:left-6 sm:right-6 h-1 sm:h-1.5 bg-stone-200 rounded-full z-0" />

          {/* Filled Active Connecting Bar */}
          <div
            className="absolute top-4 sm:top-5 left-4 sm:left-6 h-1 sm:h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 rounded-full z-0 transition-all duration-700 ease-out"
            style={{ width: `calc((100% - 2rem) * ${progressPercent / 100})` }}
          />

          {/* 3 Main Milestone Steps: Placed -> Preparing -> Ready */}
          <div className="relative z-10 flex justify-between items-start">
            {STEPS.map((step, idx) => {
              const isPassed = isServed || currentStepIdx > idx;
              const isCurrent = !isServed && currentStepIdx === idx;
              const isPending = !isServed && currentStepIdx < idx;

              return (
                <div key={step.id} className="flex flex-col items-center max-w-[85px] sm:max-w-[130px] text-center">
                  {/* Step Bubble Icon */}
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      isPassed
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        : isCurrent
                        ? 'bg-amber-500 text-stone-950 font-bold ring-2 sm:ring-4 ring-amber-400/40 shadow-lg shadow-amber-500/30 animate-pulse'
                        : 'bg-white text-stone-400 border-2 border-stone-200 shadow-xs'
                    }`}
                  >
                    {isPassed ? (
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    ) : isCurrent ? (
                      idx === 0 ? (
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-stone-950" />
                      ) : idx === 1 ? (
                        <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-stone-950" />
                      ) : (
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-stone-950" />
                      )
                    ) : (
                      <span className="font-mono text-xs font-bold text-stone-400">{idx + 1}</span>
                    )}
                  </div>

                  {/* Step Title & Subtitle */}
                  <div className="mt-1.5 sm:mt-2.5 space-y-0.5">
                    <span
                      className={`text-[10px] sm:text-xs font-bold block ${
                        isCurrent
                          ? 'text-amber-800'
                          : isPassed
                          ? 'text-emerald-800'
                          : 'text-stone-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="text-[10px] text-stone-500 hidden sm:block leading-tight">
                      {isCurrent ? step.activeDescription : step.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Delivered Notification Banner when Served */}
      {isServed && (
        <div className="bg-stone-100 border border-stone-200/80 rounded-xl p-2.5 text-center text-xs text-stone-700 flex items-center justify-center gap-2">
          <Utensils className="w-4 h-4 text-stone-500" />
          <span>Delivered to table · Thank you for dining with us!</span>
        </div>
      )}
    </div>
  );
};
