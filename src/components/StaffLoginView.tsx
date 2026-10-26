import React, { useState } from 'react';
import { Lock, KeyRound, User, Coffee, ArrowLeft, AlertCircle, Shield } from 'lucide-react';
import { StaffUser } from '../types/index.ts';
import { api } from '../lib/api.ts';

interface StaffLoginViewProps {
  onSuccessLogin: (user: StaffUser, token: string) => void;
  onCancel: () => void;
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({
  onSuccessLogin,
  onCancel
}) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter your assigned staff security PIN');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.login({
        username: username.trim() || undefined,
        pin: pin.trim()
      });
      onSuccessLogin(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Invalid staff username or security PIN');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-center items-center p-4 py-12">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <Coffee className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">
            Staff & Management Sign-In
          </h1>
          <p className="text-xs text-stone-400 max-w-xs mx-auto leading-relaxed">
            Authorized High Quality Cafe personnel only. Public registration is disabled.
          </p>
        </div>

        {/* Credentials Form */}
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-6 shadow-xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/80 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                Staff Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter assigned staff username"
                  className="w-full h-11 pl-10 pr-3 bg-stone-950 border border-stone-700 rounded-xl text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                Security PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter secret PIN code"
                  className="w-full h-11 pl-10 pr-3 bg-stone-950 border border-stone-700 rounded-xl text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[44px] py-2.5 px-4 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{isLoading ? 'Verifying Credentials...' : 'Sign In to Authorized Station'}</span>
            </button>
          </form>

          <div className="pt-4 border-t border-stone-800 flex items-start gap-2.5 text-[11px] text-stone-400 leading-relaxed">
            <Shield className="w-4 h-4 text-amber-500/80 shrink-0 mt-0.5" />
            <span>
              Staff accounts are provisioned exclusively by café administrators. Unauthenticated guests cannot create accounts or view internal stations.
            </span>
          </div>
        </div>

        {/* Exit back to public menu */}
        <div className="text-center">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors py-2 px-3 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit to Guest Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
