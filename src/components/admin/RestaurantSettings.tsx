import React, { useState, useEffect } from 'react';
import { Store, DollarSign, Clock, CheckCircle2, AlertTriangle, Image as ImageIcon } from 'lucide-react';

export function RestaurantSettings({ authToken }: { authToken: string }) {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchSettings = () => {
    fetch('/api/admin/restaurant', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setSettings(data);
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
          currency: settings.currency,
          timezone: settings.timezone,
          logo: settings.logo || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSuccessMsg('Restaurant profile and branding updated successfully');
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
          Configure restaurant identity, currency format, timezone, and brand visuals across waiter and KDS screens.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <DollarSign size={14} className="text-gray-400" /> Currency (3-Letter Code)
              </label>
              <input
                type="text"
                maxLength={3}
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
    </div>
  );
}
