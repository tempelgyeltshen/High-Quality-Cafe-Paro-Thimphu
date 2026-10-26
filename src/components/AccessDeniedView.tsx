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
      ? 'Floor Manager'
      : 'Administrator'
    : 'Unauthenticated Guest';

  const viewLabels: Record<string, string> = {
    kitchen: 'Kitchen Display System (KDS)',
    counter: 'Counter Billing & Cashier Console',
    admin: 'Administrator Hub & Business Management',
    tables: 'Table QR Code Management',
    restricted: 'Protected Internal System Route'
  };

  const getExplanation = () => {
    if (!currentUser) {
      return 'Guest customers can only access the café menu and place orders via table QR codes. Internal kitchen, billing, reporting, and management routes require server-verified staff credentials.';
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
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 shadow-lg p-6 sm:p-8 text-center space-y-5">
        <div className="w-14 h-14 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold text-rose-700">
            <Lock className="w-3.5 h-3.5" />
            <span>{currentUser ? '403 Forbidden' : '401 Authentication Required'}</span>
          </div>
          <h1 className="text-xl font-bold text-stone-900 font-display">
            Restricted Area
          </h1>
          <p className="text-xs text-stone-500">
            Target: <strong className="text-stone-800">{viewLabels[attemptedView] || attemptedView}</strong>
          </p>
        </div>

        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 text-left space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500 border-b border-stone-200 pb-1.5">
            <span>Active Session Role</span>
            <span className="font-mono text-stone-800 font-bold">{roleName}</span>
          </div>
          <p className="leading-relaxed">
            {getExplanation()}
          </p>
        </div>

        <div className="space-y-2.5 pt-1">
          {currentUser ? (
            <button
              onClick={onNavigatePermitted}
              className="w-full min-h-[44px] py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Return to Authorized Station</span>
            </button>
          ) : (
            <button
              onClick={onReturnToCustomer}
              className="w-full min-h-[44px] py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Guest Menu</span>
            </button>
          )}

          <button
            onClick={onSwitchStaff}
            className="w-full min-h-[40px] py-2 px-3 border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>{currentUser ? 'Sign In with Different Staff Account' : 'Authorized Staff Sign-In'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
