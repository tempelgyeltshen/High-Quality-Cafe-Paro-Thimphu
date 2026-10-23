import React, { useState } from 'react';
import { Lock, UserCheck, KeyRound, Coffee, ChefHat, CreditCard, Shield, ArrowLeft, AlertCircle } from 'lucide-react';
import { StaffUser } from '../types/index.ts';
import { api } from '../lib/api.ts';

interface StaffLoginViewProps {
  onSuccessLogin: (user: StaffUser, token: string) => void;
  onCancel: () => void;
  staffList: StaffUser[];
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({
  onSuccessLogin,
  onCancel,
  staffList
}) => {
  const [credential, setCredential] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential.trim()) {
      setError('Please enter your staff username or PIN code');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.login(credential.trim());
      onSuccessLogin(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Invalid username or PIN code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (user: StaffUser) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await api.login(user.username);
      onSuccessLogin(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Failed to switch staff role');
    } finally {
      setIsLoading(false);
    }
  };

  const roleIcons: Record<string, any> = {
    kitchen: ChefHat,
    cashier: CreditCard,
    admin: Shield,
    manager: Shield
  };

  const roleDisplayNames: Record<string, string> = {
    kitchen: 'Kitchen Cook (KDS Only)',
    cashier: 'Counter Staff (Billing Only)',
    admin: 'Administrator (Full Access)',
    manager: 'Floor Manager (Ops & Reports)'
  };

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col justify-center items-center p-4 py-12">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <Coffee className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">
            High Quality Cafe Staff Portal
          </h1>
          <p className="text-xs text-stone-400">
            Sign in with your role credentials to access your designated station
          </p>
        </div>

        {/* Manual Login Card */}
        <div className="bg-stone-850 rounded-2xl border border-stone-800 p-6 shadow-xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/80 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                Staff Username or PIN Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder="e.g. chef, cashier, admin or 4-digit PIN"
                  className="w-full pl-9 pr-3 py-2.5 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Authenticating...' : 'Sign In to Station'}</span>
            </button>
          </form>

          {/* Quick-Switch Evaluation Profiles */}
          <div className="pt-4 border-t border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Quick Role Switching (Demo / Evaluation)
              </span>
            </div>

            <div className="space-y-2">
              {staffList.map((st) => {
                const Icon = roleIcons[st.role] || UserCheck;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleQuickLogin(st)}
                    className="w-full p-3 bg-stone-900 hover:bg-stone-800 border border-stone-750 hover:border-amber-500/40 rounded-xl text-left transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-stone-800 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-200 group-hover:text-amber-300 transition-colors">
                          {st.name}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {roleDisplayNames[st.role] || st.role} · PIN: {st.pin}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-stone-500 group-hover:text-amber-400 font-semibold transition-colors">
                      Enter →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Back to Customer Menu */}
        <div className="text-center">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Guest Customer Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
