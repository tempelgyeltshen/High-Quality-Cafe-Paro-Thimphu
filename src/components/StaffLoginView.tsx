import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  User,
  Coffee,
  ArrowLeft,
  AlertCircle,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
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
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter your assigned staff security PIN.');
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
      setError(err.message || 'Invalid staff username or security PIN. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-center items-center p-4 py-12">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="w-12 h-12 bg-teal-50 border border-teal-200/80 text-teal-800 rounded-2xl flex items-center justify-center mx-auto">
            <Coffee className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-teal-800 block">
              High Quality Cafe · Staff Workspace
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 font-display">
              Staff &amp; Management Sign-In
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 max-w-xs mx-auto leading-relaxed">
              Sign in with your assigned station credentials. Guests never need an account to order.
            </p>
          </div>
        </div>

        {/* Credentials Form Card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-7 shadow-xs space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="staff-username"
                className="block text-xs font-bold text-stone-800"
              >
                Staff Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="staff-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. chef, cashier, gm, admin"
                  className="w-full min-h-[46px] pl-10 pr-3.5 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-teal-700 transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="staff-pin"
                className="block text-xs font-bold text-stone-800"
              >
                Security PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="staff-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="Enter your 4 to 8 digit PIN"
                  className="w-full min-h-[46px] pl-10 pr-12 bg-stone-50 border border-stone-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 font-mono focus:bg-white focus:border-teal-700 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(prev => !prev)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label={showPin ? 'Hide security PIN' : 'Show security PIN'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[48px] py-3 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span>{isLoading ? 'Verifying Credentials...' : 'Sign In to Workspace'}</span>
            </button>
          </form>

          <div className="pt-4 border-t border-stone-100 flex items-start gap-2.5 text-xs text-stone-500 leading-relaxed">
            <Shield className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>
              Role-based access routes you automatically to your permitted station (Kitchen, Counter Billing, GM Console, or Administrator Control).
            </span>
          </div>
        </div>

        {/* Return to Public Menu */}
        <div className="text-center">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 hover:border-stone-300 rounded-xl px-4 py-2.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Return to Guest Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
