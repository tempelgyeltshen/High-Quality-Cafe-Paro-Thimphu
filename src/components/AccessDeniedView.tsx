import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, UserCheck } from 'lucide-react';
import { StaffUser } from '../types/index.ts';

interface AccessDeniedViewProps {
  currentUser: StaffUser | null;
  attemptedView: string;
  onNavigatePermitted: () => void;
  onSwitchStaff: () => void;
  onReturnToCustomer: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  currentUser,
  attemptedView,
  onNavigatePermitted,
  onSwitchStaff,
  onReturnToCustomer
}) => {
  const roleName = currentUser
    ? currentUser.role === 'kitchen'
      ? 'Kitchen Cook'
      : currentUser.role === 'cashier'
      ? 'Counter Staff'
      : currentUser.role === 'manager'
      ? 'General Manager (GM)'
      : 'Administrator'
    : 'Guest Session';

  const viewLabels: Record<string, string> = {
    kitchen: 'Chef Dashboard',
    counter: 'Counter & Billing Console',
    admin: 'Order History & Management Console',
    tables: 'Table QR Code Management',
    restricted: 'Protected Internal Workspace'
  };

  const getExplanation = () => {
    if (!currentUser) {
      return 'Guests can browse the menu, place orders privately without an account, and track their own Order Confirmation ID. Staff dashboards, complete order archives, and reports require an authorized staff sign-in.';
    }
    if (currentUser.role === 'kitchen') {
      return 'Kitchen Cook accounts have dedicated access to the Chef Dashboard for preparing incoming orders. Billing, order archives, and system settings require General Manager or Administrator permissions.';
    }
    if (currentUser.role === 'cashier') {
      return 'Counter Staff accounts have dedicated access to active table billing and payment settlement. Complete historical order archives, revenue reports, and settings require General Manager or Administrator permissions.';
    }
    return 'Your current account does not have permission to open this workspace.';
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 shadow-xs p-6 sm:p-8 text-center space-y-5">
        <div className="w-12 h-12 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-800">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>{currentUser ? 'Restricted Staff Workspace' : 'Staff Sign-In Required'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 font-display">
            Access Restricted
          </h1>
          <p className="text-xs sm:text-sm text-stone-500">
            Requested page:{' '}
            <strong className="text-stone-800">
              {viewLabels[attemptedView] || attemptedView}
            </strong>
          </p>
        </div>

        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 text-left space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-500 border-b border-stone-200 pb-2">
            <span>Current Session</span>
            <span className="font-semibold text-stone-900">{roleName}</span>
          </div>
          <p className="leading-relaxed">{getExplanation()}</p>
        </div>

        <div className="space-y-2.5 pt-1">
          {currentUser ? (
            <button
              type="button"
              onClick={onNavigatePermitted}
              className="w-full min-h-[46px] py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Go to My Workspace</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onReturnToCustomer}
              className="w-full min-h-[46px] py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Return to Guest Menu</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSwitchStaff}
            className="w-full min-h-[44px] py-2.5 px-4 border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-teal-700 shrink-0" />
            <span>
              {currentUser ? 'Sign In with Different Staff Account' : 'Staff & Management Sign-In'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
