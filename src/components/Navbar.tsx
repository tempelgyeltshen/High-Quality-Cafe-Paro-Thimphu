import React from 'react';
import {
  Coffee,
  ShieldCheck,
  UserCheck,
  Wifi,
  WifiOff,
  LogOut,
  ChefHat,
  CreditCard,
  Shield,
  QrCode
} from 'lucide-react';
import { StaffUser } from '../types/index.ts';

interface NavbarProps {
  currentView: 'customer' | 'kitchen' | 'counter' | 'admin' | 'tables';
  onNavigate: (view: 'customer' | 'kitchen' | 'counter' | 'admin' | 'tables') => void;
  currentUser: StaffUser | null;
  onLogout: () => void;
  isConnected: boolean;
  onOpenTestRunner?: () => void;
  onOpenStaffLogin?: () => void;
  verifiedTableLabel?: string | null;
  verifiedTableSection?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  onLogout,
  isConnected,
  onOpenTestRunner,
  onOpenStaffLogin,
  verifiedTableLabel,
  verifiedTableSection
}) => {
  const isCustomerView = currentView === 'customer';

  const getRoleDisplayName = (role?: string) => {
    switch (role) {
      case 'kitchen': return 'Kitchen Cook';
      case 'cashier': return 'Counter Staff';
      case 'admin': return 'Administrator';
      case 'manager': return 'Floor Manager';
      default: return 'Staff Member';
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'kitchen': return ChefHat;
      case 'cashier': return CreditCard;
      case 'admin': return Shield;
      case 'manager': return Shield;
      default: return UserCheck;
    }
  };

  const RoleIcon = currentUser ? getRoleIcon(currentUser.role) : UserCheck;

  // STRICT ISOLATED GUEST HEADER: Zero links, buttons, or menus to staff/admin areas
  if (isCustomerView) {
    return (
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 text-stone-900 shadow-xs no-print w-full">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Café Brand Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 shrink-0">
              <Coffee className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-stone-900 font-display truncate block">
                High Quality Cafe
              </span>
              <span className="hidden sm:inline-block text-[11px] text-stone-500 truncate">
                Paro, Bhutan · Open 24/7
              </span>
            </div>
          </div>

          {/* Assigned Table Context Only (No Staff/Admin Links) */}
          <div className="flex items-center gap-2 shrink-0 text-xs">
            {verifiedTableLabel ? (
              <div className="text-right">
                <span className="font-bold text-stone-900 font-display block leading-tight">
                  {verifiedTableLabel}
                </span>
                {verifiedTableSection && (
                  <span className="text-[11px] text-stone-500 hidden xs:block leading-tight">
                    {verifiedTableSection}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs font-medium text-stone-500">
                Table Menu
              </span>
            )}
          </div>
        </div>
      </header>
    );
  }

  // AUTHENTICATED STAFF STATION HEADER (Separate Staff Routes Only)
  return (
    <header className="sticky top-0 z-40 bg-stone-950 border-b border-stone-800 text-stone-100 shadow-md no-print">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand Wordmark & Signed-In Role */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Coffee className="w-4 h-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-white font-display hidden md:inline">
              High Quality Cafe
            </span>
          </div>

          {currentUser && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-stone-300 border-l border-stone-800 pl-3 truncate">
              <RoleIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-stone-200 hidden lg:inline truncate">
                {currentUser.name}
              </span>
              <span className="text-stone-500 hidden lg:inline">·</span>
              <span className="text-amber-300 font-medium whitespace-nowrap">
                {getRoleDisplayName(currentUser.role)}
              </span>
            </div>
          )}
        </div>

        {/* Role-Filtered Station Navigation */}
        <nav className="flex items-center gap-1 sm:gap-1.5 text-xs font-semibold overflow-x-auto scrollbar-none">
          {(currentUser?.role === 'kitchen' || currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
            <button
              onClick={() => onNavigate('kitchen')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer min-h-[36px] ${
                currentView === 'kitchen'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-stone-400 hover:text-white hover:bg-stone-900'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5 shrink-0" />
              <span>Kitchen KDS</span>
            </button>
          )}

          {(currentUser?.role === 'cashier' || currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
            <button
              onClick={() => onNavigate('counter')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer min-h-[36px] ${
                currentView === 'counter'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-stone-400 hover:text-white hover:bg-stone-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span>Counter</span>
            </button>
          )}

          {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
            <>
              <button
                onClick={() => onNavigate('admin')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer min-h-[36px] ${
                  currentView === 'admin'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-stone-400 hover:text-white hover:bg-stone-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>Admin Hub</span>
              </button>

              <button
                onClick={() => onNavigate('tables')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer min-h-[36px] ${
                  currentView === 'tables'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-stone-400 hover:text-white hover:bg-stone-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Table QRs</span>
                <span className="sm:hidden">QRs</span>
              </button>
            </>
          )}
        </nav>

        {/* Station Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="hidden xl:flex items-center gap-1.5 text-xs text-stone-400 mr-1"
            title={isConnected ? 'Live SSE Connected' : 'Reconnecting to server...'}
          >
            {isConnected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="font-mono text-[10px] text-stone-300">{isConnected ? 'LIVE' : 'SYNCING'}</span>
          </span>

          {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && onOpenTestRunner && (
            <button
              onClick={onOpenTestRunner}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-300 bg-amber-950/60 border border-amber-800/80 rounded-lg hover:bg-amber-900/60 transition-colors whitespace-nowrap cursor-pointer min-h-[36px]"
              title="Run RBAC & security compliance suite"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Security Tests</span>
            </button>
          )}

          {onOpenStaffLogin && (
            <button
              onClick={onOpenStaffLogin}
              className="px-2.5 py-1.5 text-xs font-medium text-stone-200 bg-stone-900 border border-stone-800 rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[36px]"
              title="Sign in with a different staff PIN"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Switch Account</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="px-2.5 py-1.5 text-xs font-medium text-rose-300 bg-stone-900 border border-stone-800 rounded-lg hover:bg-rose-950/50 hover:border-rose-800/60 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[36px]"
            title="Sign out of staff station"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
