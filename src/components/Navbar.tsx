import React, { useState } from 'react';
import {
  Coffee,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  Wifi,
  WifiOff,
  LogOut,
  ChefHat,
  CreditCard,
  Shield,
  QrCode,
  Lock,
  ChevronDown,
  ArrowRight
} from 'lucide-react';
import { StaffUser } from '../types/index.ts';

interface NavbarProps {
  currentView: 'customer' | 'kitchen' | 'counter' | 'admin' | 'tables';
  onNavigate: (view: 'customer' | 'kitchen' | 'counter' | 'admin' | 'tables') => void;
  currentUser: StaffUser | null;
  onLoginDemoUser: (user: StaffUser) => void;
  onLogout: () => void;
  staffList: StaffUser[];
  isConnected: boolean;
  onOpenTestRunner: () => void;
  onOpenStaffLogin?: () => void;
  currentTableId?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  onLoginDemoUser,
  onLogout,
  staffList,
  isConnected,
  onOpenTestRunner,
  onOpenStaffLogin,
  currentTableId = 'T01'
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const isCustomerView = currentView === 'customer';

  // Role display helpers
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

  // Render CUSTOMER VIEW top bar (Zero staff slop, no staff tabs)
  if (isCustomerView) {
    return (
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 text-stone-900 shadow-xs no-print w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
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

          {/* Right Action: Tests & Discreet Staff Portal access */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Acceptance Test Runner */}
            <button
              onClick={onOpenTestRunner}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors whitespace-nowrap shadow-xs min-h-[36px]"
              title="Verify system compliance and role security"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="hidden sm:inline">Test Roles & RBAC</span>
              <span className="sm:hidden text-[11px]">Tests</span>
            </button>

            {/* Staff Entry Gate */}
            {currentUser ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    if (currentUser.role === 'kitchen') onNavigate('kitchen');
                    else if (currentUser.role === 'cashier') onNavigate('counter');
                    else onNavigate('admin');
                  }}
                  className="px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs min-h-[36px]"
                >
                  <RoleIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Resume {getRoleDisplayName(currentUser.role)}</span>
                  <span className="sm:hidden text-[11px]">Station</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (onOpenStaffLogin) {
                    onOpenStaffLogin();
                  } else {
                    onNavigate('kitchen');
                  }
                }}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg transition-colors flex items-center gap-1.5 min-h-[36px]"
                title="Restricted portal for Kitchen, Counter, and Admin staff"
              >
                <Lock className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span className="hidden sm:inline">Staff Portal</span>
                <span className="sm:hidden text-[11px]">Staff</span>
              </button>
            )}
          </div>
        </div>
      </header>
    );
  }

  // Render STAFF VIEW top bar (Role-enforced navigation)
  return (
    <header className="sticky top-0 z-40 bg-stone-950 border-b border-stone-850 text-stone-100 shadow-md no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Wordmark & Role Indicator */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('customer')}
            className="flex items-center gap-2 text-left group focus:outline-none"
            title="Switch back to Customer View"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Coffee className="w-4 h-4" />
            </div>
            <span className="text-base font-bold tracking-tight text-white font-display hidden sm:inline">
              High Quality Cafe
            </span>
          </button>

          {/* Current Staff Role Badge */}
          {currentUser && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-900 border border-stone-800 rounded-lg text-xs">
              <RoleIcon className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold text-stone-200 hidden md:inline">
                {currentUser.name}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider">
                {getRoleDisplayName(currentUser.role)}
              </span>
            </div>
          )}
        </div>

        {/* Role-Filtered Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2 text-xs font-semibold">
          {/* Kitchen Cook Nav */}
          {(currentUser?.role === 'kitchen' || currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
            <button
              onClick={() => onNavigate('kitchen')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentView === 'kitchen'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-stone-400 hover:text-white hover:bg-stone-900'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Kitchen KDS</span>
            </button>
          )}

          {/* Counter Staff Nav */}
          {(currentUser?.role === 'cashier' || currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
            <button
              onClick={() => onNavigate('counter')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                currentView === 'counter'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-stone-400 hover:text-white hover:bg-stone-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Counter Billing</span>
            </button>
          )}

          {/* Administrator Only Nav */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
            <>
              <button
                onClick={() => onNavigate('admin')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentView === 'admin'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-stone-400 hover:text-white hover:bg-stone-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Hub</span>
              </button>

              <button
                onClick={() => onNavigate('tables')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentView === 'tables'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-stone-400 hover:text-white hover:bg-stone-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table QR Cards</span>
                <span className="sm:hidden">QR</span>
              </button>
            </>
          )}
        </nav>

        {/* Right Station Actions */}
        <div className="flex items-center gap-2">
          {/* Live Sync Status */}
          <span className="hidden lg:flex items-center gap-1.5 text-xs text-stone-400 mr-1" title={isConnected ? 'Live SSE Connected' : 'Reconnecting to server...'}>
            {isConnected ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
            <span className="font-mono text-[10px] text-stone-300">{isConnected ? 'LIVE' : 'SYNCING'}</span>
          </span>

          {/* Test runner button */}
          <button
            onClick={onOpenTestRunner}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-300 bg-amber-950/60 border border-amber-800/80 rounded-lg hover:bg-amber-900/60 transition-colors whitespace-nowrap"
            title="Run acceptance test verification"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Verify Tests</span>
          </button>

          {/* Role Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="px-2.5 py-1.5 text-xs font-medium text-stone-200 bg-stone-900 border border-stone-800 rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Switch Role</span>
              <ChevronDown className="w-3 h-3 text-stone-400" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-stone-900 border border-stone-750 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in-50 zoom-in-95">
                <div className="px-3 py-2 text-xs font-bold text-stone-400 border-b border-stone-800 flex items-center justify-between">
                  <span>Switch Active Staff Station</span>
                  <span className="text-[10px] font-mono text-stone-500">RBAC Demo</span>
                </div>

                <div className="py-1.5 space-y-1">
                  {staffList.map((st) => {
                    const StIcon = getRoleIcon(st.role);
                    return (
                      <button
                        key={st.id}
                        onClick={() => {
                          onLoginDemoUser(st);
                          setShowRoleMenu(false);
                          if (st.role === 'kitchen') onNavigate('kitchen');
                          else if (st.role === 'cashier') onNavigate('counter');
                          else onNavigate('admin');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          currentUser?.id === st.id
                            ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                            : 'text-stone-300 hover:bg-stone-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <StIcon className="w-4 h-4 text-amber-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-stone-200">{st.name}</div>
                            <div className="text-[10px] text-stone-400 capitalize">
                              {getRoleDisplayName(st.role)} · PIN: {st.pin}
                            </div>
                          </div>
                        </div>
                        {currentUser?.id === st.id && (
                          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-stone-800 flex flex-col gap-1">
                  <button
                    onClick={() => {
                      onNavigate('customer');
                      setShowRoleMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-amber-400 hover:bg-stone-800 transition-colors flex items-center justify-between"
                  >
                    <span>View Customer Ordering Menu</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      onLogout();
                      setShowRoleMenu(false);
                      onNavigate('customer');
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-stone-800 transition-colors flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out to Guest Mode</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
