import React, { useState } from 'react';
import { ChefHat, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle2, RotateCcw, ShieldAlert } from 'lucide-react';
import { RestosLogo } from './RestosLogo';

interface LoginScreenProps {
  onLogin: (token: string) => void;
  onReset?: () => void;
  message?: string;
}

export function LoginScreen({ onLogin, onReset, message }: { onLogin: (token: string) => void; onReset?: () => void; message?: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDevResetModal, setShowDevResetModal] = useState(false);
  const [devResetLoading, setDevResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Ensure deviceId exists
    let deviceId = localStorage.getItem('restaurantos_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('restaurantos_device_id', deviceId);
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceId })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      onLogin(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDevReset = async () => {
    setDevResetLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/dev-reset-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'RESET_LOCAL_DEVELOPMENT_DATABASE' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset development database');
      
      localStorage.removeItem('restaurantos_auth_token');
      setShowDevResetModal(false);
      if (onReset) {
        onReset();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setError(err.message);
      setShowDevResetModal(false);
    } finally {
      setDevResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Dev Reset Modal */}
      {showDevResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900">[DEV ONLY] Reset Database</h3>
                <span className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">Development Environment</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              This will clear all records in the local development database (restaurants, users, tables, menu, orders) to return the Hub to a completely fresh, unconfigured state.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-[11px] text-amber-800">
              <strong>Notice:</strong> This endpoint is strictly restricted to development mode and is completely disabled in production builds.
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDevResetModal(false)}
                disabled={devResetLoading}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDevReset}
                disabled={devResetLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {devResetLoading ? 'Resetting...' : 'Confirm DB Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center mb-2">
          <RestosLogo className="h-12 sm:h-14 w-auto drop-shadow-xs" />
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 rounded-2xl sm:px-10">
          {message && (
            <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User size={13} className="text-gray-400" /> Username
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Lock size={13} className="text-gray-400" /> Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </div>
          </form>

          {/* Development mode DB reset action */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-5 border-t border-dashed border-gray-200 text-center">
              <button
                type="button"
                onClick={() => setShowDevResetModal(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                [DEV ONLY] Reset Database to Fresh State
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
