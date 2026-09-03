import React, { useState, useEffect } from 'react';
import { Store, DollarSign, Clock, CheckCircle2, AlertTriangle, Image as ImageIcon, RotateCcw, ShieldAlert, Globe } from 'lucide-react';
import { useI18n } from '../../i18n';

export function RestaurantSettings({ authToken }: { authToken: string }) {
  const { setLanguage: setGlobalLanguage, t } = useI18n();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showDevResetModal, setShowDevResetModal] = useState(false);
  const [devResetLoading, setDevResetLoading] = useState(false);

  const fetchSettings = () => {
    fetch('/api/admin/restaurant', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else {
          setSettings(data);
          if (data.language) {
            setGlobalLanguage(data.language);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSettings();
  }, [authToken]);

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
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
      setShowDevResetModal(false);
    } finally {
      setDevResetLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        setError('Logo image must be smaller than 1MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setSettings((prev: any) => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/restaurant', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: settings.name,
          language: settings.language || 'en',
          currency: settings.currency,
          timezone: settings.timezone,
          logo: settings.logo || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSuccessMsg('Restaurant profile and language updated successfully');
      if (settings.language) {
        setGlobalLanguage(settings.language);
      }
      setTimeout(() => setSuccessMsg(''), 3500);
      fetchSettings();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-gray-500">Loading restaurant profile...</div>;
  if (!settings) return <div className="p-8 text-center text-sm text-red-500">{error || 'Restaurant profile not found'}</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Store className="w-6 h-6 text-amber-500" /> Restaurant Profile & Branding
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Configure restaurant identity, language, currency format, timezone, and brand visuals across waiter and KDS screens.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" /> {successMsg}
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Restaurant Name *
              </label>
              <input
                type="text"
                value={settings.name || ''}
                onChange={e => setSettings({ ...settings, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Globe size={14} className="text-gray-400" /> System Language
              </label>
              <select
                value={settings.language || 'en'}
                onChange={e => setSettings({ ...settings, language: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:border-amber-500 outline-none font-medium"
              >
                <option value="en">English (US / UK)</option>
                <option value="fr">Français (French)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <DollarSign size={14} className="text-gray-400" /> Currency (3-Letter Code)
              </label>
              <input
                type="text"
                maxLength={4}
                value={settings.currency || 'USD'}
                onChange={e => setSettings({ ...settings, currency: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono uppercase text-gray-900 focus:bg-white focus:border-amber-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Clock size={14} className="text-gray-400" /> Timezone
              </label>
              <input
                type="text"
                value={settings.timezone || 'UTC'}
                onChange={e => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:border-amber-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Brand Logo / Icon
            </label>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              {settings.logo ? (
                <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden bg-white shadow-xs flex items-center justify-center shrink-0">
                  <img src={settings.logo} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl border border-dashed border-gray-300 bg-white flex flex-col items-center justify-center text-gray-400 text-[10px] shrink-0">
                  <ImageIcon size={20} className="mb-0.5" />
                  No logo
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs">
                  Upload New Logo
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {settings.logo && (
                  <button
                    type="button"
                    onClick={() => setSettings((p: any) => ({ ...p, logo: '' }))}
                    className="block text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Remove Logo
                  </button>
                )}
                <p className="text-[11px] text-gray-400">PNG, JPG, or SVG up to 1MB. Visible on POS header.</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving Changes...' : 'Save Restaurant Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Development Environment Database Reset Card */}
      {import.meta.env.DEV && (
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px] font-bold uppercase tracking-wider">
                  Development Only
                </span>
                <h3 className="text-xs font-bold text-gray-900">Database Reset to Fresh State</h3>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Clears all restaurant configuration, users, tables, and live order records to test the initial first-run setup flow.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDevResetModal(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <RotateCcw size={13} />
              Reset DB
            </button>
          </div>
        </div>
      )}

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
              Are you sure you want to reset the development database? This will purge all restaurants, users, orders, and tables, returning the Local Hub to the initial setup screen.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-[11px] text-amber-800">
              <strong>Confirmation:</strong> This operation requires the explicit development confirmation token and is completely unavailable in production.
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
    </div>
  );
}
