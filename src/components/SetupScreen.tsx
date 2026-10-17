import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { 
  UtensilsCrossed, 
  ShieldCheck, 
  LayoutGrid, 
  DollarSign, 
  Clock, 
  Store, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Globe, 
  Key, 
  Copy, 
  Check, 
  AlertCircle, 
  RefreshCw,
  CheckCircle2,
  Calendar,
  Hourglass
} from 'lucide-react';
import { useI18n } from '../i18n';

const setupSchema = z.object({
  restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  language: z.enum(['en', 'fr']).default('en'),
  currency: z.string().length(3, 'Currency must be a 3-letter code (e.g. USD, EUR)').default('USD'),
  timezone: z.string().min(1, 'Timezone is required').default('UTC'),
  seatingCapacity: z.number().int().min(1).default(30),
  logo: z.string().optional(),
  tableCount: z.number().int().min(1).max(100).default(10),
  sections: z.array(z.string()).min(1).default(['Main Dining', 'Patio', 'Bar']),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters'),
  ownerUsername: z.string().min(3, 'Username must be at least 3 characters'),
  ownerPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

const POPULAR_CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD ($) - US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR (€) - Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP (£) - British Pound' },
  { code: 'CAD', symbol: '$', label: 'CAD ($) - Canadian Dollar' },
  { code: 'AUD', symbol: '$', label: 'AUD ($) - Australian Dollar' },
  { code: 'CHF', symbol: 'CHF', label: 'CHF (CHF) - Swiss Franc' },
  { code: 'MAD', symbol: 'DH', label: 'MAD (DH) - Moroccan Dirham' },
  { code: 'DZD', symbol: 'DA', label: 'DZD (DA) - Algerian Dinar' },
  { code: 'TND', symbol: 'DT', label: 'TND (DT) - Tunisian Dinar' },
  { code: 'XOF', symbol: 'CFA', label: 'XOF (CFA) - West African CFA' },
];

export function SetupScreen({ onComplete }: { onComplete: (token?: string) => void }) {
  const { t, language, setLanguage, formatDate } = useI18n();

  const [formData, setFormData] = useState({
    restaurantName: '',
    language: 'en' as 'en' | 'fr',
    currency: 'USD',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    seatingCapacity: 30,
    logo: '',
    tableCount: 10,
    sections: ['Main Dining', 'Patio', 'Bar'],
    ownerName: '',
    ownerUsername: '',
    ownerPassword: ''
  });

  const [customTables, setCustomTables] = useState<Array<{ number: number; label: string; section: string }>>([
    { number: 1, label: 'Table 1', section: 'Main Dining' },
    { number: 2, label: 'Table 2', section: 'Main Dining' },
    { number: 3, label: 'Table 3', section: 'Main Dining' },
    { number: 4, label: 'Table 4', section: 'Main Dining' },
    { number: 5, label: 'Table 5', section: 'Main Dining' },
  ]);
  const [useCustomTableNumbers, setUseCustomTableNumbers] = useState(false);

  const [customCurrency, setCustomCurrency] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newSectionInput, setNewSectionInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Licensing state
  const [installationId, setInstallationId] = useState<string>('');
  const [licenseKeyInput, setLicenseKeyInput] = useState<string>('');
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [activatingLicense, setActivatingLicense] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseSuccess, setLicenseSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Fetch installation ID and initial license state
  useEffect(() => {
    const fetchInstallationAndStatus = async () => {
      try {
        const res = await fetch('/api/licensing/status');
        if (res.ok) {
          const data = await res.json();
          setInstallationId(data.installationId || '');
          setLicenseStatus(data);
        }
      } catch (err) {
        console.error('Failed to load installation identity', err);
      }
    };
    fetchInstallationAndStatus();
  }, []);

  const handleLanguageChange = (lang: 'en' | 'fr') => {
    setFormData(prev => ({ ...prev, language: lang }));
    setLanguage(lang);
  };

  const handleCopyInstallationId = () => {
    if (!installationId) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(installationId);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = installationId;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  const mapLicenseErrorMessage = (serverError: string): string => {
    if (!serverError) return t('licensing.invalidLicense');
    const lower = serverError.toLowerCase();
    if (lower.includes('expired')) return t('licensing.licenseExpired');
    if (lower.includes('belongs to another installation') || lower.includes('installation mismatch')) {
      return t('licensing.anotherInstallation');
    }
    if (lower.includes('signature') || lower.includes('tamper')) return t('licensing.signatureInvalid');
    if (lower.includes('product')) return t('licensing.productInvalid');
    if (lower.includes('format') || lower.includes('malformed') || lower.includes('header')) {
      return t('licensing.codeMalformed');
    }
    return serverError;
  };

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;

    setActivatingLicense(true);
    setLicenseError(null);
    setLicenseSuccess(null);

    try {
      const res = await fetch('/api/licensing/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKeyInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'License activation failed');
      }

      setLicenseStatus(data.status);
      setLicenseSuccess(t('licensing.licenseActivated'));
      setLicenseKeyInput('');
    } catch (err: any) {
      setLicenseError(mapLicenseErrorMessage(err.message));
    } finally {
      setActivatingLicense(false);
    }
  };

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

    // Strict Production Constraint: License must be active
    if (!licenseStatus || !licenseStatus.isLicensed || !licenseStatus.canOperate) {
      setError(t('licensing.licenseRequired'));
      return;
    }

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
      const setupBody = useCustomTableNumbers
        ? { ...formData, initialTables: customTables }
        : formData;

      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupBody)
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

  const isLicenseActive = licenseStatus && licenseStatus.isLicensed && licenseStatus.canOperate;

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5" /> {t('setup.badge')}
        </div>
        <div className="flex items-center justify-center gap-3">
          <img src="/logo.svg" alt="RestaurantOS" className="w-11 h-11 drop-shadow-xs" />
          <h1 className="text-3xl font-black tracking-tight text-white">{t('setup.title')}</h1>
        </div>
        <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">
          {t('setup.welcomeDesc')}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-neutral-800/90 border border-neutral-700/80 backdrop-blur-sm py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          <form className="space-y-7" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: RESTAURANT IDENTITY */}
            <div>
              <div className="flex items-center gap-2 border-b border-neutral-700 pb-2.5 mb-4">
                <Store className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-semibold text-white">{t('setup.restaurantDetails')}</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-300 mb-1">{t('setup.restaurantName')} *</label>
                  <input
                    type="text"
                    required
                    placeholder={t('setup.restaurantNamePlaceholder')}
                    value={formData.restaurantName}
                    onChange={e => setFormData({ ...formData, restaurantName: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* LANGUAGE SELECTION */}
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-neutral-400" /> {t('setup.languageLabel')} *
                  </label>
                  <select
                    value={formData.language}
                    onChange={e => handleLanguageChange(e.target.value as 'en' | 'fr')}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
                  >
                    <option value="en">English (en)</option>
                    <option value="fr">Français (fr)</option>
                  </select>
                </div>

                {/* CURRENCY SELECTION */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-neutral-300 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-neutral-400" /> {t('setup.currencyLabel')} *
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomCurrency(!customCurrency)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                    >
                      {customCurrency ? 'Presets' : 'Custom'}
                    </button>
                  </div>
                  {customCurrency ? (
                    <input
                      type="text"
                      required
                      maxLength={4}
                      placeholder="USD"
                      value={formData.currency}
                      onChange={e => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white font-mono uppercase focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  ) : (
                    <select
                      value={formData.currency}
                      onChange={e => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    >
                      {POPULAR_CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" /> {t('setup.timezoneLabel')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.timezone}
                    onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5 mb-1.5">
                    Total Seating Capacity (Seats) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.seatingCapacity}
                    onChange={e => setFormData({ ...formData, seatingCapacity: Number(e.target.value) })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* STEP 2: RESTAURANTOS LICENSE ACTIVATION */}
            <div className="bg-neutral-900/80 border border-neutral-700/80 rounded-xl p-5">
              <div className="flex items-center justify-between border-b border-neutral-700/60 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-400" />
                  <div>
                    <h2 className="text-base font-semibold text-white">{t('licensing.restaurantOSLicense')}</h2>
                    <p className="text-xs text-neutral-400">{t('licensing.subtitle')}</p>
                  </div>
                </div>

                {isLicenseActive ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t('licensing.licenseActive')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-bold">
                    <AlertCircle className="w-3.5 h-3.5" /> Required
                  </span>
                )}
              </div>

              {/* INSTALLATION ID DISPLAY (No manual typing required by customer) */}
              <div className="mb-4 bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                      {t('licensing.installationId')}
                    </span>
                    <span className="font-mono text-sm text-amber-300 font-semibold tracking-wide">
                      {installationId || 'Loading...'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyInstallationId}
                    disabled={!installationId}
                    className="flex items-center gap-1 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-md transition-colors cursor-pointer"
                  >
                    {copiedId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">{t('licensing.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('licensing.copyId')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* ACTIVE LICENSE STATUS OR ACTIVATION FORM */}
              {isLicenseActive ? (
                <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-lg p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between text-emerald-300 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>{t('licensing.expiresLabel')}: {formatDate(licenseStatus.expiresAt)}</span>
                    </span>
                    <span className="flex items-center gap-1.5 font-bold">
                      <Hourglass className="w-4 h-4 text-emerald-400" />
                      <span>{t('licensing.daysRemainingLabel')}: {licenseStatus.remainingDays} {t('licensing.days')}</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {licenseError && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{licenseError}</span>
                    </div>
                  )}

                  {licenseSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-lg text-xs font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{licenseSuccess}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      {t('licensing.licenseCodeLabel')} *
                    </label>
                    <textarea
                      rows={2}
                      placeholder={t('licensing.licenseCodePlaceholder')}
                      value={licenseKeyInput}
                      onChange={e => setLicenseKeyInput(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleActivateLicense}
                    disabled={activatingLicense || !licenseKeyInput.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-bold text-xs bg-neutral-700 hover:bg-neutral-600 text-white disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {activatingLicense ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{t('licensing.activating')}</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t('licensing.activateBtn')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* STEP 3: PRIMARY OWNER ACCOUNT */}
            <div>
              <div className="flex items-center gap-2 border-b border-neutral-700 pb-2.5 mb-4">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-semibold text-white">{t('setup.adminAccount')}</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-300 mb-1">{t('setup.adminName')} *</label>
                  <input
                    type="text"
                    required
                    placeholder={t('setup.adminNamePlaceholder')}
                    value={formData.ownerName}
                    onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">{t('setup.adminUsername')} *</label>
                  <input
                    type="text"
                    required
                    placeholder={t('setup.adminUsernamePlaceholder')}
                    value={formData.ownerUsername}
                    onChange={e => setFormData({ ...formData, ownerUsername: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center justify-between">
                    <span>{t('setup.adminPassword')} *</span>
                    <span className="text-[11px] text-neutral-400">{t('setup.minCharacters')}</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder={t('setup.adminPasswordPlaceholder')}
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

            {/* STEP 4: INITIAL TABLES & DINING AREAS */}
            <div>
              <div className="flex items-center justify-between border-b border-neutral-700 pb-2.5 mb-4">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-semibold text-white">{t('setup.diningLayout')}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setUseCustomTableNumbers(!useCustomTableNumbers)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                >
                  {useCustomTableNumbers ? '← Auto Numbering (1..N)' : 'Customize Table Numbers'}
                </button>
              </div>

              <div className="space-y-4">
                {!useCustomTableNumbers ? (
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      {t('setup.tableCountLabel')}
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
                ) : (
                  <div className="bg-neutral-900/90 border border-neutral-700 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-200">Custom Table List ({customTables.length} tables)</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextNum = customTables.length > 0 ? Math.max(...customTables.map(t => t.number)) + 1 : 1;
                          setCustomTables([...customTables, { number: nextNum, label: `Table ${nextNum}`, section: formData.sections[0] || 'Main Dining' }]);
                        }}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-lg cursor-pointer"
                      >
                        + Add Custom Table
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {customTables.map((tItem, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                          <input
                            type="number"
                            min={1}
                            value={tItem.number}
                            onChange={e => {
                              const newNum = parseInt(e.target.value) || 1;
                              const updated = [...customTables];
                              updated[idx].number = newNum;
                              setCustomTables(updated);
                            }}
                            className="w-20 bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-xs text-white"
                            placeholder="Num"
                          />
                          <input
                            type="text"
                            value={tItem.label}
                            onChange={e => {
                              const updated = [...customTables];
                              updated[idx].label = e.target.value;
                              setCustomTables(updated);
                            }}
                            className="flex-1 bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-xs text-white"
                            placeholder="Label"
                          />
                          <select
                            value={tItem.section}
                            onChange={e => {
                              const updated = [...customTables];
                              updated[idx].section = e.target.value;
                              setCustomTables(updated);
                            }}
                            className="w-32 bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-xs text-white"
                          >
                            {formData.sections.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          {customTables.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setCustomTables(customTables.filter((_, i) => i !== idx))}
                              className="text-red-400 hover:text-red-300 font-bold px-1"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    {t('setup.sectionsLabel')}
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
                            className="text-neutral-400 hover:text-red-400 ml-1 font-bold cursor-pointer"
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
                      placeholder={t('setup.addSectionPlaceholder')}
                      value={newSectionInput}
                      onChange={e => setNewSectionInput(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddSection}
                      className="px-3.5 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-xs font-medium text-white transition-colors cursor-pointer"
                    >
                      {t('setup.addSectionBtn')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !isLicenseActive}
                className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {loading 
                  ? t('setup.initializing') 
                  : !isLicenseActive 
                  ? t('licensing.licenseRequired') 
                  : t('setup.submitBtn')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
