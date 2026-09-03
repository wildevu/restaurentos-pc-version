import React, { useState } from 'react';
import { z } from 'zod';
import { UtensilsCrossed, ShieldCheck, LayoutGrid, DollarSign, Clock, Store, Eye, EyeOff, Sparkles, Globe } from 'lucide-react';

const setupSchema = z.object({
  restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  language: z.enum(['en', 'fr']).default('en'),
  currency: z.string().length(3, 'Currency must be a 3-letter code (e.g. USD, EUR)').default('USD'),
  timezone: z.string().min(1, 'Timezone is required').default('UTC'),
  logo: z.string().optional(),
  tableCount: z.number().int().min(1).max(100).default(10),
  sections: z.array(z.string()).min(1).default(['Main Dining', 'Patio', 'Bar']),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters'),
  ownerUsername: z.string().min(3, 'Username must be at least 3 characters'),
  ownerPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export function SetupScreen({ onComplete }: { onComplete: (token?: string) => void }) {
  const [formData, setFormData] = useState({
    restaurantName: '',
    language: 'en' as 'en' | 'fr',
    currency: 'USD',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    logo: '',
    tableCount: 10,
    sections: ['Main Dining', 'Patio', 'Bar'],
    ownerName: '',
    ownerUsername: '',
    ownerPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [newSectionInput, setNewSectionInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSectionInput.trim();
    if (trimmed && !formData.sections.includes(trimmed)) {
      setFormData(prev => ({ ...prev, sections: [...prev.sections, trimmed] }));
      setNewSectionInput('');
    }
  };

  const handleRemoveSection = (secToRemove: string) => {
    if (formData.sections.length <= 1) return;
    setFormData(prev => ({ ...prev, sections: prev.sections.filter(s => s !== secToRemove) }));
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
        setFormData(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      setupSchema.parse(formData);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        const issues = (err as any).issues || (err as any).errors || [];
        setError(issues[0]?.message || 'Validation failed');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Setup failed');
      
      onComplete(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5" /> Initial First-Run Setup
        </div>
        <div className="flex items-center justify-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center text-neutral-950 font-bold shadow-lg shadow-amber-500/20">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">RestaurantOS</h1>
        </div>
        <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">
          Welcome to your local-first authoritative restaurant hub. Complete this initial one-time configuration to initialize your restaurant and primary Owner account.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-neutral-800/90 border border-neutral-700/80 backdrop-blur-sm py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}
            
            {/* Section 1: Restaurant Identity */}
            <div>
              <div className="flex items-center gap-2 border-b border-neutral-700 pb-2.5 mb-4">
                <Store className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-semibold text-white">1. Restaurant Identity</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Restaurant Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bistro Central"
                    value={formData.restaurantName}
                    onChange={e => setFormData({ ...formData, restaurantName: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-neutral-400" /> Application Language *
                  </label>
                  <select
                    value={formData.language}
                    onChange={e => setFormData({ ...formData, language: e.target.value as 'en' | 'fr' })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
                  >
                    <option value="en">English (en)</option>
                    <option value="fr">Français (fr)</option>
                  </select>
                  <p className="text-[11px] text-neutral-400 mt-1">Authoritative language used across all Waiter, Kitchen, Cashier, and Admin terminals.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-neutral-400" /> Currency (3-Letter Code) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="USD"
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white font-mono uppercase focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" /> Timezone *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.timezone}
                    onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Brand Logo / Icon (Optional)</label>
                  <div className="flex items-center gap-4">
                    {formData.logo ? (
                      <div className="w-12 h-12 rounded-lg border border-neutral-700 overflow-hidden bg-neutral-900 flex items-center justify-center shrink-0">
                        <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-dashed border-neutral-700 bg-neutral-900 flex items-center justify-center text-neutral-500 text-xs shrink-0">
                        No logo
                      </div>
                    )}
                    <label className="cursor-pointer bg-neutral-700 hover:bg-neutral-600 text-neutral-200 px-3 py-2 rounded-lg text-xs font-medium transition-colors">
                      Choose File
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                    {formData.logo && (
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, logo: '' }))}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Table & Section Layout */}
            <div>
              <div className="flex items-center gap-2 border-b border-neutral-700 pb-2.5 mb-4">
                <LayoutGrid className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-semibold text-white">2. Initial Tables & Dining Areas</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Initial Table Count (auto-created 1 to N)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.tableCount}
                    onChange={e => setFormData({ ...formData, tableCount: parseInt(e.target.value) || 1 })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Dining Sections / Areas
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.sections.map(sec => (
                      <span
                        key={sec}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-900 border border-neutral-700 rounded-full text-xs font-medium text-neutral-200"
                      >
                        {sec}
                        {formData.sections.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(sec)}
                            className="text-neutral-400 hover:text-red-400 ml-1 font-bold"
                          >
                            &times;
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add section (e.g. Upstairs, Terrace)"
                      value={newSectionInput}
                      onChange={e => setNewSectionInput(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddSection}
                      className="px-3.5 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-xs font-medium text-white transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Owner Credentials */}
            <div>
              <div className="flex items-center gap-2 border-b border-neutral-700 pb-2.5 mb-4">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-semibold text-white">3. Primary Owner Account</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Owner Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Miller"
                    value={formData.ownerName}
                    onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Owner Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="owner"
                    value={formData.ownerUsername}
                    onChange={e => setFormData({ ...formData, ownerUsername: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center justify-between">
                    <span>Owner Password *</span>
                    <span className="text-[11px] text-neutral-400">Min 6 characters</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={formData.ownerPassword}
                      onChange={e => setFormData({ ...formData, ownerPassword: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-3.5 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? 'Initializing RestaurantOS Hub...' : 'Complete Hub Setup & Launch'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
