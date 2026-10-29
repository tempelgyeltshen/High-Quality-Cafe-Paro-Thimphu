import React from 'react';
import {
  CheckCircle2,
  Clock,
  Check,
  ChefHat,
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
    description: 'Sent to kitchen queue',
    activeDescription: 'Received and queued for preparation'
  },
  {
    id: 'preparing',
    label: 'Preparing',
    shortLabel: 'Preparing',
    description: 'Cooked fresh to order',
    activeDescription: 'Our cooks are preparing your dishes'
  },
  {
    id: 'ready',
    label: 'Ready to Serve',
    shortLabel: 'Ready',
    description: 'Plated for service or pickup',
    activeDescription: 'Ready now for service or counter pickup'
  }
];

export const OrderStatusTracker: React.FC<OrderStatusTrackerProps> = ({
  status,
  orderNumber,
  orderTime,
  variant = 'full',
  className = ''
}) => {
  const getStepIndex = (st: OrderStatus): number => {
    switch (st) {
      case 'submitted':
        return 0;
      case 'acknowledged':
      case 'preparing':
        return 1;
      case 'ready':
        return 2;
      case 'served':
        return 3;
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  };

  const currentStepIdx = getStepIndex(status);
  const isCancelled = status === 'cancelled';
  const isServed = status === 'served';

  // Pure Tailwind width utilities (zero inline style props)
  const getTrackWidthClass = (): string => {
    if (isCancelled) return 'w-0';
    if (isServed) return 'w-full';
    if (currentStepIdx === 0) return 'w-1/12';
    if (currentStepIdx === 1) return 'w-1/2';
    if (currentStepIdx === 2) return 'w-full';
    return 'w-0';
  };

  const trackWidthClass = getTrackWidthClass();

  if (isCancelled) {
    return (
      <div
        role="status"
        className={`bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-3 text-rose-900 ${className}`}
      >
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold">Order Cancelled</p>
          <p className="text-xs text-rose-700">
            This order round was cancelled by café staff. Please ask at the counter if you need assistance.
          </p>
        </div>
      </div>
    );
  }

  // Mini variant (for dense list summaries)
  if (variant === 'mini') {
    const miniLabel = isServed
      ? 'Served'
      : currentStepIdx === 2
      ? 'Ready'
      : currentStepIdx === 1
      ? 'Preparing'
      : 'Placed';

    return (
      <div className={`space-y-1.5 ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-stone-600">Progress</span>
          <span className="font-semibold text-teal-800">{miniLabel}</span>
        </div>
        <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200">
          <div
            className={`h-full transition-all duration-500 rounded-full ${trackWidthClass} ${
              isServed
                ? 'bg-stone-600'
                : currentStepIdx === 2
                ? 'bg-emerald-600'
                : 'bg-teal-700'
            }`}
          />
        </div>
        <div className="flex justify-between text-[11px] text-stone-500">
          <span className={currentStepIdx >= 0 ? 'text-stone-900 font-semibold' : ''}>Placed</span>
          <span className={currentStepIdx >= 1 ? 'text-stone-900 font-semibold' : ''}>Preparing</span>
          <span className={currentStepIdx >= 2 ? 'text-emerald-800 font-semibold' : ''}>Ready</span>
        </div>
      </div>
    );
  }

  // Compact variant (used in the active order callout on the Menu tab)
  if (variant === 'compact') {
    return (
      <div className={`bg-stone-50 border border-stone-200 rounded-xl p-3.5 sm:p-4 ${className}`}>
        {(orderNumber || orderTime) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-stone-200/80 text-xs">
            <div className="flex items-center gap-2 text-stone-700">
              <span className="font-semibold text-teal-800">Live Kitchen Progress</span>
              {orderNumber && (
                <>
                  <span className="text-stone-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono font-bold text-stone-900 tabular-nums">
                    {orderNumber}
                  </span>
                </>
              )}
            </div>
            {orderTime && (
              <span className="text-stone-500 inline-flex items-center gap-1 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>Placed at {orderTime}</span>
              </span>
            )}
          </div>
        )}

        <div className="px-2 sm:px-6 pt-1">
          <div className="relative">
            {/* Background Connecting Track */}
            <div className="absolute top-4 left-4 right-4 h-1 bg-stone-200 rounded-full z-0">
              <div
                className={`h-full rounded-full transition-all duration-500 ${trackWidthClass} ${
                  currentStepIdx >= 2 ? 'bg-emerald-600' : 'bg-teal-700'
                }`}
              />
            </div>

            {/* 3 Milestone Nodes */}
            <div className="relative z-10 flex justify-between items-start">
              {STEPS.map((step, idx) => {
                const isPassed = isServed || currentStepIdx > idx;
                const isCurrent = !isServed && currentStepIdx === idx;

                return (
                  <div key={step.id} className="flex flex-col items-center text-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isPassed
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                          ? 'bg-teal-700 text-white ring-4 ring-teal-700/15'
                          : 'bg-white text-stone-500 border border-stone-300'
                      }`}
                    >
                      {isPassed ? (
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      ) : isCurrent ? (
                        idx === 0 ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : idx === 1 ? (
                          <ChefHat className="w-4 h-4" />
                        ) : (
                          <Utensils className="w-4 h-4" />
                        )
                      ) : (
                        <span className="font-mono tabular-nums">{idx + 1}</span>
                      )}
                    </div>

                    <span
                      className={`mt-1.5 text-xs whitespace-nowrap ${
                        isCurrent
                          ? 'text-teal-900 font-bold'
                          : isPassed
                          ? 'text-emerald-800 font-semibold'
                          : 'text-stone-500 font-medium'
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

  // Full variant (used in PreviousOrdersView cards & Order Confirmation modal)
  return (
    <div className={`bg-stone-50/90 border border-stone-200 rounded-xl p-4 sm:p-5 space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-3">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-stone-800 block">
            Order Preparation Status
          </span>
          <p className="text-xs text-stone-600">
            {isServed
              ? 'All dishes have been served. Enjoy your meal!'
              : STEPS[currentStepIdx]?.activeDescription || 'Order received by kitchen'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {isServed ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-200/80 text-stone-800">
              <Utensils className="w-3.5 h-3.5 text-stone-600 shrink-0" />
              <span>Completed</span>
            </span>
          ) : currentStepIdx === 2 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Ready to Serve</span>
            </span>
          ) : currentStepIdx === 1 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 border border-sky-200 text-sky-900 font-bold">
              <ChefHat className="w-3.5 h-3.5 text-sky-700 shrink-0" />
              <span>Preparing in Kitchen</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-bold">
              <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Order Received</span>
            </span>
          )}
        </div>
      </div>

      {/* 3-Step Visual Stepper */}
      <div className="pt-1 pb-1 px-2 sm:px-6">
        <div className="relative">
          {/* Connecting Bar */}
          <div className="absolute top-4 sm:top-5 left-5 right-5 sm:left-7 sm:right-7 h-1 bg-stone-200 rounded-full z-0">
            <div
              className={`h-full rounded-full transition-all duration-500 ${trackWidthClass} ${
                isServed || currentStepIdx >= 2 ? 'bg-emerald-600' : 'bg-teal-700'
              }`}
            />
          </div>

          {/* Milestone Nodes */}
          <div className="relative z-10 flex justify-between items-start">
            {STEPS.map((step, idx) => {
              const isPassed = isServed || currentStepIdx > idx;
              const isCurrent = !isServed && currentStepIdx === idx;

              return (
                <div
                  key={step.id}
                  className="flex flex-col items-center max-w-[92px] sm:max-w-[140px] text-center"
                >
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors ${
                      isPassed
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-teal-700 text-white ring-4 ring-teal-700/15'
                        : 'bg-white text-stone-500 border border-stone-300'
                    }`}
                  >
                    {isPassed ? (
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                    ) : isCurrent ? (
                      idx === 0 ? (
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : idx === 1 ? (
                        <ChefHat className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <Utensils className="w-4 h-4 sm:w-5 sm:h-5" />
                      )
                    ) : (
                      <span className="font-mono text-xs font-bold tabular-nums">{idx + 1}</span>
                    )}
                  </div>

                  <div className="mt-2 space-y-0.5">
                    <span
                      className={`text-xs block ${
                        isCurrent
                          ? 'text-teal-900 font-bold'
                          : isPassed
                          ? 'text-emerald-800 font-semibold'
                          : 'text-stone-500 font-medium'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="text-[11px] text-stone-500 hidden sm:block leading-snug">
                      {isCurrent ? step.activeDescription : step.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isServed && (
        <div className="bg-white border border-stone-200 rounded-lg px-3.5 py-2.5 text-center text-xs text-stone-700 flex items-center justify-center gap-2">
          <Utensils className="w-4 h-4 text-teal-700 shrink-0" />
          <span>Served · Thank you for dining at High Quality Cafe</span>
        </div>
      )}
    </div>
  );
};
