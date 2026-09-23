import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { ShieldCheck, ShieldAlert, Key, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';

interface LicenseStatusData {
  status: 'ACTIVE' | 'EXPIRED' | 'UNLICENSED' | 'CLOCK_ROLLBACK_DETECTED';
  isLicensed: boolean;
  canOperate: boolean;
  installationId: string;
  restaurantId?: string;
  licenseId?: string;
  durationDays?: number;
  activatedAt?: string;
  expiresAt?: string;
  remainingDays?: number;
  clockRollbackDetected?: boolean;
}

export const LicenseManagement: React.FC = () => {
  const { t, formatDate } = useI18n();
  const [status, setStatus] = useState<LicenseStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [licenseKeyInput, setLicenseKeyInput] = useState<string>('');
  const [activating, setActivating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchStatus = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/licensing/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch license status', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCopyInstallationId = () => {
    if (!status?.installationId) return;
    navigator.clipboard.writeText(status.installationId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;

    setActivating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/licensing/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKeyInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || t('licensing.activationFailed'));
      } else {
        setSuccessMessage(t('licensing.activationSuccess'));
        setLicenseKeyInput('');
        if (data.statusInfo) {
          setStatus(data.statusInfo);
        }
        await fetchStatus(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || t('licensing.activationFailed'));
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div id="license-management-loading" className="flex items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-3 text-emerald-600" />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  const getStatusBadge = () => {
    if (!status) return null;
    switch (status.status) {
      case 'ACTIVE':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{t('licensing.active')}</span>
          </div>
        );
      case 'EXPIRED':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-sm font-semibold border border-rose-200">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>{t('licensing.expired')}</span>
          </div>
        );
      case 'CLOCK_ROLLBACK_DETECTED':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-sm font-semibold border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{t('licensing.clockRollback')}</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold border border-slate-200">
            <Key className="w-4 h-4 text-slate-500" />
            <span>{t('licensing.unlicensed')}</span>
          </div>
        );
    }
  };

  return (
    <div id="license-management-container" className="space-y-6">
      {/* Header */}
      <div>
        <h2 id="license-management-title" className="text-xl font-bold text-slate-900">{t('licensing.title')}</h2>
        <p id="license-management-subtitle" className="text-sm text-slate-500 mt-1">{t('licensing.subtitle')}</p>
      </div>

      {/* Status Card */}
      <div id="license-status-card" className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t('licensing.status')}</span>
            <div className="mt-2">{getStatusBadge()}</div>
          </div>
          {status?.status === 'ACTIVE' && status.remainingDays !== undefined && (
            <div className="text-left sm:text-right">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t('licensing.remainingDays')}</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{status.remainingDays} <span className="text-sm font-normal text-slate-500">{t('licensing.days')}</span></p>
            </div>
          )}
        </div>

        {/* Installation ID Section */}
        <div className="mt-6">
          <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
            {t('licensing.installationId')}
          </label>
          <div className="flex items-center gap-2">
            <code id="installation-id-code" className="flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-sm font-mono text-slate-800 select-all overflow-x-auto">
              {status?.installationId || '—'}
            </code>
            <button
              id="copy-installation-id-btn"
              type="button"
              onClick={handleCopyInstallationId}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? t('licensing.copied') : t('licensing.copyId')}</span>
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{t('licensing.installationIdHelp')}</p>
        </div>

        {/* License Metadata Details */}
        {status?.status === 'ACTIVE' && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-100 text-sm">
            <div>
              <span className="text-xs text-slate-400 font-medium">{t('licensing.licenseId')}</span>
              <p className="font-mono text-slate-700 mt-0.5">{status.licenseId}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium">{t('licensing.activatedAt')}</span>
              <p className="text-slate-700 mt-0.5">{status.activatedAt ? formatDate(status.activatedAt) : '—'}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium">{t('licensing.expiresAt')}</span>
              <p className="text-slate-700 mt-0.5">{status.expiresAt ? formatDate(status.expiresAt) : '—'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Activation / Renewal Form */}
      <div id="license-activation-form-card" className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h3 id="activation-card-heading" className="text-base font-bold text-slate-900 mb-2">
          {status?.status === 'ACTIVE' ? t('licensing.renewBtn') : t('licensing.activateBtn')}
        </h3>
        
        {errorMessage && (
          <div id="license-error-banner" className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div id="license-success-banner" className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <label htmlFor="licenseKeyInput" className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">
              {t('licensing.enterCode')}
            </label>
            <textarea
              id="licenseKeyInput"
              rows={3}
              value={licenseKeyInput}
              onChange={(e) => setLicenseKeyInput(e.target.value)}
              placeholder={t('licensing.enterCodePlaceholder')}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              id="submit-license-btn"
              type="submit"
              disabled={activating || !licenseKeyInput.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {activating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t('common.saving')}</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>{status?.status === 'ACTIVE' ? t('licensing.renewBtn') : t('licensing.activateBtn')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
