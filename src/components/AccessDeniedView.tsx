import React from 'react';
import { ShieldAlert, ArrowLeft, UserCheck, Lock } from 'lucide-react';
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
      : currentUser.role
    : 'Guest Customer';

  const viewLabels: Record<string, string> = {
    kitchen: 'Kitchen Display System (KDS)',
    counter: 'Counter Billing & Cashier Console',
    admin: 'Administrator Hub & Business Management',
    tables: 'Table QR Code Management'
  };

  const getExplanation = () => {
    if (!currentUser) {
      return 'You must sign in with an authorized staff account to access this page. Customers cannot access kitchen, billing, or administration areas.';
    }
    if (currentUser.role === 'kitchen') {
      return 'Kitchen Cook accounts are restricted strictly to food and beverage preparation on the Kitchen Display System (KDS). You do not have permission to view customer billing, payments, sales reports, or administrator settings.';
    }
    if (currentUser.role === 'cashier') {
      return 'Counter Staff accounts are restricted strictly to billing, payments, and order settlements. You do not have permission to access menu pricing management, staff accounts, system settings, or confidential business reports.';
    }
    return 'Your current role does not have authorization to access this area.';
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 shadow-xl p-6 sm:p-8 text-center space-y-5 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <Lock className="w-3 h-3" />
            <span>403 FORBIDDEN · ACCESS BLOCKED</span>
          </div>
          <h2 className="text-xl font-bold text-stone-900 font-display">
            Permission Restricted
          </h2>
          <p className="text-xs text-stone-500 font-medium">
            Attempted to access: <strong className="text-stone-800">{viewLabels[attemptedView] || attemptedView}</strong>
          </p>
        </div>

        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 text-left space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 border-b border-stone-200 pb-1.5">
            <span>Current Signed-in Profile</span>
            <span className="font-mono text-stone-800 font-bold uppercase">{roleName}</span>
          </div>
          <p className="leading-relaxed">
            {getExplanation()}
          </p>
        </div>

        <div className="space-y-2 pt-2">
          {currentUser && (
            <button
              onClick={onNavigatePermitted}
              className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <span>Return to Permitted Interface</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onSwitchStaff}
              className="py-2.5 px-3 border border-stone-200 hover:bg-stone-100 text-stone-800 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Switch Account</span>
            </button>

            <button
              onClick={onReturnToCustomer}
              className="py-2.5 px-3 border border-stone-200 hover:bg-stone-100 text-stone-800 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-stone-500" />
              <span>Customer Menu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
