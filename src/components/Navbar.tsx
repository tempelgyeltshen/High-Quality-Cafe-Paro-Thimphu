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
      case 'kitchen':
        return 'Kitchen Cook';
      case 'cashier':
        return 'Counter Staff';
      case 'admin':
        return 'Administrator';
      case 'manager':
        return 'General Manager';
      default:
        return 'Staff Member';
    }
  };

  // STRICT ISOLATED GUEST HEADER: Zero links, buttons, or menus to staff/admin areas
  if (isCustomerView) {
    return (
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 text-stone-900 no-print w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Café Brand Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-800 shrink-0">
              <Coffee className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-sm sm:text-base font-bold tracking-tight text-stone-900 font-display truncate block leading-tight">
                High Quality Cafe
              </span>
              <span className="text-[11px] sm:text-xs text-stone-500 truncate block leading-tight">
                Paro, Bhutan · Open 24/7
              </span>
            </div>
          </div>

          {/* Assigned Table / Anonymous Context Only (Zero Staff/Admin Links) */}
          <div className="flex items-center gap-2 shrink-0 text-right">
            {verifiedTableLabel ? (
              <div>
                <span className="text-xs sm:text-sm font-bold text-stone-900 font-display block leading-tight">
                  {verifiedTableLabel}
                </span>
                <span className="text-[11px] text-teal-800 font-medium block leading-tight">
                  {verifiedTableSection ? `${verifiedTableSection} · Private QR` : 'Private Table Session'}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-xs sm:text-sm font-semibold text-stone-900 block leading-tight">
                  Guest Ordering
                </span>
                <span className="text-[11px] text-stone-500 block leading-tight">
                  Anonymous · No Login
                </span>
              </div>
            )}
          </div>
        </div>
      </header>
    );
  }

  // Build role-permitted station links
  const navItems: Array<{
    id: 'kitchen' | 'counter' | 'admin' | 'tables';
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [];

  if (currentUser?.role === 'kitchen' || currentUser?.role === 'admin' || currentUser?.role === 'manager') {
    navItems.push({
      id: 'kitchen',
      label: 'Chef Dashboard',
      shortLabel: 'Kitchen',
      icon: ChefHat
    });
  }

  if (currentUser?.role === 'cashier' || currentUser?.role === 'admin' || currentUser?.role === 'manager') {
    navItems.push({
      id: 'counter',
      label: 'Counter & Billing',
      shortLabel: 'Counter',
      icon: CreditCard
    });
  }

  if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
    navItems.push({
      id: 'admin',
      label: currentUser.role === 'manager' ? 'GM & Order History' : 'Admin & History',
      shortLabel: currentUser.role === 'manager' ? 'GM Hub' : 'Admin Hub',
      icon: Shield
    });
    navItems.push({
      id: 'tables',
      label: 'Table QRs',
      shortLabel: 'Table QRs',
      icon: QrCode
    });
  }

  // UNIFIED AUTHENTICATED STAFF WORKSPACE HEADER
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 text-stone-900 no-print w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Brand & Signed-In Operator */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-800 shrink-0">
                <Coffee className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-sm sm:text-base font-bold tracking-tight text-stone-900 font-display truncate block leading-tight">
                  High Quality Cafe
                </span>
                {currentUser && (
                  <span className="text-[11px] text-stone-500 truncate block sm:hidden leading-tight">
                    {getRoleDisplayName(currentUser.role)}
                  </span>
                )}
              </div>
            </div>

            {currentUser && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-stone-500 border-l border-stone-200 pl-3 min-w-0">
                <span className="font-semibold text-stone-800 hidden xl:inline truncate max-w-[140px]">
                  {currentUser.name}
                </span>
                <span className="text-stone-300 hidden xl:inline" aria-hidden="true">
                  ·
                </span>
                <span className="text-stone-600 font-medium whitespace-nowrap">
                  {getRoleDisplayName(currentUser.role)}
                </span>
              </div>
            )}
          </div>

          {/* Desktop Station Navigation (>= lg) */}
          <nav
            aria-label="Staff Workspaces"
            className="hidden lg:flex items-center gap-1 text-xs font-semibold"
          >
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-900 border-teal-200 font-bold'
                      : 'border-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-teal-700' : 'text-stone-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Station Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span
              className="hidden xl:inline-flex items-center gap-1.5 text-xs text-stone-500 pr-1"
              title={isConnected ? 'Real-time updates connected' : 'Syncing real-time connection'}
            >
              {isConnected ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
              <span className="font-medium text-stone-600">{isConnected ? 'Live' : 'Syncing'}</span>
            </span>

            {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && onOpenTestRunner && (
              <button
                type="button"
                onClick={onOpenTestRunner}
                className="hidden sm:inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 hover:border-stone-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Run security and role-based access compliance suite"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span className="hidden md:inline">Compliance Suite</span>
                <span className="md:hidden">Tests</span>
              </button>
            )}

            {onOpenStaffLogin && (
              <button
                type="button"
                onClick={onOpenStaffLogin}
                className="min-h-[40px] sm:min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 hover:border-stone-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                title="Switch to a different staff account"
              >
                <UserCheck className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span className="hidden sm:inline">Switch Staff</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="min-h-[40px] sm:min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              title="Sign out of this station"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tablet & Mobile Station Switcher (< lg, shown only when user has multiple permitted workspaces) */}
        {navItems.length > 1 && (
          <nav
            aria-label="Mobile Staff Workspaces"
            className="flex lg:hidden items-center gap-1.5 pb-2.5 overflow-x-auto scrollbar-none border-t border-stone-100 pt-2"
          >
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.shortLabel}</span>
                </button>
              );
            })}

            {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && onOpenTestRunner && (
              <button
                type="button"
                onClick={onOpenTestRunner}
                className="sm:hidden min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>Compliance</span>
              </button>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};
