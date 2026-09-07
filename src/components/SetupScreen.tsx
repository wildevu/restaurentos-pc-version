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
  Hourglass,
  Plus,
  Trash2,
  Edit2
} from 'lucide-react';
import { useI18n } from '../i18n';
import { RestosLogo } from './RestosLogo';

export interface CategorySection {
  name: string;
  tableNumbers: number[];
}

export function parseTableNumbersInput(input: string): number[] {
  if (!input || !input.trim()) return [];
  const parts = input.split(/[\s,]+/);
  const result: number[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Range syntax e.g. 1-5 or 10-15
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      if (max - min <= 500) {
        for (let i = min; i <= max; i++) {
          if (i > 0 && i < 10000) result.push(i);
        }
      }
      continue;
    }

    // Single number
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num > 0 && num < 10000) {
      result.push(num);
    }
  }

  return Array.from(new Set(result)).sort((a, b) => a - b);
}

const setupSchema = z.object({
  restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  language: z.enum(['en', 'fr']).default('en'),
  currency: z.string().length(3, 'Currency must be a 3-letter code (e.g. USD, EUR)').default('USD'),
  timezone: z.string().min(1, 'Timezone is required').default('UTC'),
  logo: z.string().optional(),
  tableCount: z.number().int().min(1).max(500).optional(),
  sections: z.array(z.string()).min(1).default(['Main Dining', 'Patio', 'Bar']),
  initialTables: z.array(z.object({
    number: z.number().int().min(1),
    label: z.string().optional(),
    section: z.string().optional(),
  })).optional(),
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
    logo: '',
    tableCount: 10,
    sections: ['Main Dining', 'Patio', 'Bar'],
    ownerName: '',
    ownerUsername: '',
    ownerPassword: ''
  });

  // Dining categories & manual table numbers configuration
  const [categorySections, setCategorySections] = useState<CategorySection[]>([
    { name: 'Main Dining', tableNumbers: [1, 2, 3, 4, 5] },
    { name: 'Patio', tableNumbers: [6, 7, 8] },
    { name: 'Bar', tableNumbers: [9, 10] },
  ]);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryTables, setNewCategoryTables] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingNumbersText, setEditingNumbersText] = useState('');
  const [newTableInputs, setNewTableInputs] = useState<Record<number, string>>({});

  const [customCurrency, setCustomCurrency] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newSectionInput, setNewSectionInput] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    navigator.clipboard.writeText(installationId);
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

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.ok
            ? 'Server returned an invalid response format.'
            : `Server communication error (HTTP ${res.status || 'aborted'}). Please verify that RestaurantOS is running.`
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || 'License activation failed');
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

  const totalConfiguredTables = categorySections.reduce((acc, cat) => acc + cat.tableNumbers.length, 0);
  const allCurrentNumbers = categorySections.flatMap(c => c.tableNumbers);
  const maxNumber = allCurrentNumbers.length > 0 ? Math.max(...allCurrentNumbers) : 0;
  const nextSuggestedStart = maxNumber + 1;
  const nextSuggestedRange = `${nextSuggestedStart}-${nextSuggestedStart + 4}`;
  const duplicateNumbers = allCurrentNumbers.filter((n, idx) => allCurrentNumbers.indexOf(n) !== idx);
  const hasDuplicates = duplicateNumbers.length > 0;

  const handleAddCategory = () => {
    setCategoryError('');
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setCategoryError('Please enter a category name (e.g. Terrace, Bar, VIP).');
      return;
    }
    if (categorySections.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setCategoryError(`Category "${trimmedName}" already exists.`);
      return;
    }

    let numbersToAdd: number[] = [];
    const trimmedTables = newCategoryTables.trim();
    if (trimmedTables) {
      numbersToAdd = parseTableNumbersInput(trimmedTables);
      if (numbersToAdd.length === 0) {
        setCategoryError('Please enter valid table numbers (e.g. 11-15 or 11, 12, 13).');
        return;
      }
    } else {
      // Auto-assign next 5 tables if left blank
      for (let i = nextSuggestedStart; i < nextSuggestedStart + 5; i++) {
        numbersToAdd.push(i);
      }
    }

    setCategorySections(prev => [...prev, { name: trimmedName, tableNumbers: numbersToAdd }]);
    setNewCategoryName('');
    setNewCategoryTables('');
  };

  const handleRemoveCategory = (index: number) => {
    if (categorySections.length <= 1) return;
    setCategorySections(prev => prev.filter((_, i) => i !== index));
    if (editingCategoryIndex === index) {
      setEditingCategoryIndex(null);
    }
  };

  const handleRemoveTable = (catIndex: number, tableNum: number) => {
    setCategorySections(prev => prev.map((cat, idx) => {
      if (idx !== catIndex) return cat;
      return {
        ...cat,
        tableNumbers: cat.tableNumbers.filter(n => n !== tableNum)
      };
    }));
  };

  const handleAddSingleTable = (catIndex: number) => {
    const rawVal = newTableInputs[catIndex]?.trim();
    let numToAdd = nextSuggestedStart;
    if (rawVal) {
      const parsed = parseInt(rawVal, 10);
      if (!isNaN(parsed) && parsed > 0) {
        numToAdd = parsed;
      }
    }

    setCategorySections(prev => prev.map((cat, idx) => {
      if (idx !== catIndex) return cat;
      if (cat.tableNumbers.includes(numToAdd)) return cat;
      const updated = [...cat.tableNumbers, numToAdd].sort((a, b) => a - b);
      return { ...cat, tableNumbers: updated };
    }));

    setNewTableInputs(prev => ({ ...prev, [catIndex]: '' }));
  };

  const handleStartEditNumbers = (catIndex: number) => {
    setEditingCategoryIndex(catIndex);
    setEditingNumbersText(categorySections[catIndex].tableNumbers.join(', '));
  };

  const handleSaveEditedNumbers = (catIndex: number) => {
    const parsed = parseTableNumbersInput(editingNumbersText);
    setCategorySections(prev => prev.map((cat, idx) => {
      if (idx !== catIndex) return cat;
      return { ...cat, tableNumbers: parsed };
    }));
    setEditingCategoryIndex(null);
  };

  const handleCancelEditNumbers = () => {
    setEditingCategoryIndex(null);
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
    setFieldErrors({});

    // Strict Production Constraint: License must be active
    if (!licenseStatus || !licenseStatus.isLicensed || !licenseStatus.canOperate) {
      setError(t('licensing.licenseRequired'));
      const el = document.getElementById('setup-license-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Check table configurations
    if (hasDuplicates) {
      const dupNum = duplicateNumbers[0];
      const dupMsg = t('setup.duplicateWarning') 
        ? t('setup.duplicateWarning').replace('{num}', dupNum.toString())
        : `Duplicate table number detected: Table #${dupNum} appears in multiple categories. Each table number must be unique.`;
      setError(dupMsg);
      const el = document.getElementById('setup-dining-layout-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (totalConfiguredTables === 0) {
      setError(t('setup.noTablesWarning') || 'Please configure at least one table before continuing.');
      const el = document.getElementById('setup-dining-layout-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const initialTables = categorySections.flatMap(cat =>
      cat.tableNumbers.map(num => ({
        number: num,
        label: `Table ${num}`,
        section: cat.name,
      }))
    );
    initialTables.sort((a, b) => a.number - b.number);

    const submissionData = {
      ...formData,
      tableCount: totalConfiguredTables,
      sections: categorySections.map(c => c.name),
      initialTables
    };

    try {
      setupSchema.parse(submissionData);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        const issues = (err as any).issues || (err as any).errors || [];
        const newFieldErrors: Record<string, string> = {};
        for (const issue of issues) {
          const path = issue.path?.[0];
          if (path && typeof path === 'string') {
            newFieldErrors[path] = issue.message;
          }
        }
        setFieldErrors(newFieldErrors);
        setError(issues[0]?.message || 'Please complete all required fields.');
        setTimeout(() => {
          const firstErrInput = document.querySelector('[data-has-error="true"]');
          firstErrInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.ok
            ? 'Server returned an invalid response format.'
            : `Server connection error (HTTP ${res.status || 'aborted'}). Please verify that RestaurantOS is running.`
        );
      }

      if (!res.ok) throw new Error(data?.error || 'Setup failed');

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
        <div className="flex items-center justify-center mb-2">
          <RestosLogo className="h-12 sm:h-14 w-auto drop-shadow-md" />
        </div>
        <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">
          {t('setup.welcomeDesc')}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-neutral-800/90 border border-neutral-700/80 backdrop-blur-sm py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          <form className="space-y-7" onSubmit={handleSubmit} noValidate>
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
                    data-has-error={!!fieldErrors.restaurantName}
                    placeholder={t('setup.restaurantNamePlaceholder')}
                    value={formData.restaurantName}
                    onChange={e => {
                      setFormData({ ...formData, restaurantName: e.target.value });
                      if (fieldErrors.restaurantName) setFieldErrors(prev => ({ ...prev, restaurantName: '' }));
                    }}
                    className={`w-full bg-neutral-900 border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none transition-colors ${
                      fieldErrors.restaurantName 
                        ? 'border-red-500 ring-1 ring-red-500' 
                        : 'border-neutral-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                    }`}
                  />
                  {fieldErrors.restaurantName && (
                    <p className="mt-1 text-xs text-red-400 font-medium">{fieldErrors.restaurantName}</p>
                  )}
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
              </div>
            </div>

            {/* STEP 2: RESTAURANTOS LICENSE ACTIVATION */}
            <div id="setup-license-section" className="bg-neutral-900/80 border border-neutral-700/80 rounded-xl p-5">
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
                    data-has-error={!!fieldErrors.ownerName}
                    placeholder={t('setup.adminNamePlaceholder')}
                    value={formData.ownerName}
                    onChange={e => {
                      setFormData({ ...formData, ownerName: e.target.value });
                      if (fieldErrors.ownerName) setFieldErrors(prev => ({ ...prev, ownerName: '' }));
                    }}
                    className={`w-full bg-neutral-900 border rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors ${
                      fieldErrors.ownerName ? 'border-red-500 ring-1 ring-red-500' : 'border-neutral-700 focus:border-amber-500'
                    }`}
                  />
                  {fieldErrors.ownerName && (
                    <p className="mt-1 text-xs text-red-400 font-medium">{fieldErrors.ownerName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">{t('setup.adminUsername')} *</label>
                  <input
                    type="text"
                    data-has-error={!!fieldErrors.ownerUsername}
                    placeholder={t('setup.adminUsernamePlaceholder')}
                    value={formData.ownerUsername}
                    onChange={e => {
                      setFormData({ ...formData, ownerUsername: e.target.value });
                      if (fieldErrors.ownerUsername) setFieldErrors(prev => ({ ...prev, ownerUsername: '' }));
                    }}
                    className={`w-full bg-neutral-900 border rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors ${
                      fieldErrors.ownerUsername ? 'border-red-500 ring-1 ring-red-500' : 'border-neutral-700 focus:border-amber-500'
                    }`}
                  />
                  {fieldErrors.ownerUsername && (
                    <p className="mt-1 text-xs text-red-400 font-medium">{fieldErrors.ownerUsername}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1 flex items-center justify-between">
                    <span>{t('setup.adminPassword')} *</span>
                    <span className="text-[11px] text-neutral-400">{t('setup.minCharacters')}</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      data-has-error={!!fieldErrors.ownerPassword}
                      placeholder={t('setup.adminPasswordPlaceholder')}
                      value={formData.ownerPassword}
                      onChange={e => {
                        setFormData({ ...formData, ownerPassword: e.target.value });
                        if (fieldErrors.ownerPassword) setFieldErrors(prev => ({ ...prev, ownerPassword: '' }));
                      }}
                      className={`w-full bg-neutral-900 border rounded-lg pl-3.5 pr-10 py-2.5 text-sm text-white focus:outline-none transition-colors ${
                        fieldErrors.ownerPassword ? 'border-red-500 ring-1 ring-red-500' : 'border-neutral-700 focus:border-amber-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.ownerPassword && (
                    <p className="mt-1 text-xs text-red-400 font-medium">{fieldErrors.ownerPassword}</p>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 4: DINING CATEGORIES & MANUAL TABLE NUMBERS */}
            <div id="setup-dining-layout-section">
              <div className="flex items-center justify-between border-b border-neutral-700 pb-2.5 mb-4">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-semibold text-white">{t('setup.diningLayout')}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-full">
                    {totalConfiguredTables} {totalConfiguredTables === 1 ? 'Table' : 'Tables'} ({categorySections.length} {categorySections.length === 1 ? 'Category' : 'Categories'})
                  </span>
                </div>
              </div>

              <p className="text-xs text-neutral-400 mb-4">
                {t('setup.diningLayoutDesc')}
              </p>

              {/* Duplicate Warning */}
              {hasDuplicates && (
                <div className="mb-4 p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{t('setup.duplicateWarning')?.replace('{num}', duplicateNumbers[0]?.toString()) || `Duplicate table number: Table #${duplicateNumbers[0]}`}</span>
                    <p className="text-red-400/80 mt-0.5">Please ensure every table has a unique number across all categories.</p>
                  </div>
                </div>
              )}

              {/* Categories list */}
              <div className="space-y-3 mb-5">
                {categorySections.map((cat, catIdx) => {
                  const isEditing = editingCategoryIndex === catIdx;
                  return (
                    <div
                      key={`${cat.name}-${catIdx}`}
                      className="bg-neutral-900/80 border border-neutral-700/80 hover:border-neutral-600 rounded-xl p-3.5 transition-colors"
                    >
                      {/* Category Header */}
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{cat.name}</span>
                          <span className="text-[11px] px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded-md text-neutral-300">
                            {cat.tableNumbers.length} {cat.tableNumbers.length === 1 ? 'table' : 'tables'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => isEditing ? handleSaveEditedNumbers(catIdx) : handleStartEditNumbers(catIdx)}
                            className="px-2.5 py-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            {isEditing ? t('setup.applyNumbers') : t('setup.editNumbers')}
                          </button>
                          {categorySections.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCategory(catIdx)}
                              className="p-1 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Editing Numbers Box or Badges */}
                      {isEditing ? (
                        <div className="space-y-2 pt-1">
                          <label className="block text-[11px] text-neutral-400">
                            Enter table numbers (e.g. 1-5 or 10, 11, 12):
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editingNumbersText}
                              onChange={e => setEditingNumbersText(e.target.value)}
                              placeholder="e.g. 1-5 or 10, 11, 12"
                              className="flex-1 bg-neutral-950 border border-amber-500/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEditedNumbers(catIdx);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditedNumbers(catIdx)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            >
                              {t('setup.applyNumbers')}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditNumbers}
                              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition-colors cursor-pointer"
                            >
                              {t('setup.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {/* Table number badges */}
                          <div className="flex flex-wrap gap-1.5 mb-2.5">
                            {cat.tableNumbers.length === 0 ? (
                              <span className="text-xs text-neutral-500 italic py-1">No tables assigned yet</span>
                            ) : (
                              cat.tableNumbers.map(num => {
                                const isDup = duplicateNumbers.includes(num);
                                return (
                                  <span
                                    key={num}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                      isDup
                                        ? 'bg-red-500/20 border border-red-500 text-red-200'
                                        : 'bg-neutral-800/90 border border-neutral-700 text-neutral-200'
                                    }`}
                                  >
                                    <span>#{num}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTable(catIdx, num)}
                                      className="text-neutral-400 hover:text-red-400 font-bold ml-0.5 cursor-pointer"
                                      title={`Remove table ${num}`}
                                    >
                                      &times;
                                    </button>
                                  </span>
                                );
                              })
                            )}
                          </div>

                          {/* Quick single table add */}
                          <div className="flex items-center gap-2 pt-1 border-t border-neutral-800/60">
                            <span className="text-[11px] text-neutral-400">{t('setup.addSingleTable')}</span>
                            <input
                              type="number"
                              min={1}
                              max={9999}
                              value={newTableInputs[catIdx] ?? ''}
                              placeholder={`${nextSuggestedStart}`}
                              onChange={e => setNewTableInputs(prev => ({ ...prev, [catIdx]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddSingleTable(catIdx);
                                }
                              }}
                              className="w-20 bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddSingleTable(catIdx)}
                              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md text-xs font-medium transition-colors cursor-pointer"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add New Category Panel */}
              <div className="bg-neutral-900/50 border border-dashed border-neutral-700/90 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  Add New Category & Set Table Numbers Manually
                </h3>

                {categoryError && (
                  <p className="text-xs text-red-400 mb-2.5">{categoryError}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      Category / Area Name *
                    </label>
                    <input
                      type="text"
                      placeholder={t('setup.addCategoryPlaceholder')}
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        }
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                      Table Numbers (Manual or Range)
                    </label>
                    <input
                      type="text"
                      placeholder={`e.g. ${nextSuggestedRange} or ${nextSuggestedStart}, ${nextSuggestedStart + 1}`}
                      value={newCategoryTables}
                      onChange={e => setNewCategoryTables(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        }
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-[11px] text-neutral-500">
                    Enter individual numbers (e.g. 10, 11), ranges (e.g. 11-15), or leave blank to auto-assign next 5 tables.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 hover:text-amber-300 border border-neutral-700 hover:border-neutral-600 rounded-lg text-xs font-semibold transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('setup.addCategoryBtn')}
                  </button>
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON & BOTTOM ERROR NOTICE */}
            <div className="pt-2 space-y-3">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {!isLicenseActive && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between gap-2">
                  <span>{t('licensing.licenseRequired')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('setup-license-section');
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="underline text-amber-400 hover:text-amber-200 font-semibold shrink-0 cursor-pointer"
                  >
                    Go to License Step &uarr;
                  </button>
                </div>
              )}

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
