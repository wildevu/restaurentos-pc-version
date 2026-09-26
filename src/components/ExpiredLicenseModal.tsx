import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useI18n } from '../i18n';
import { ShieldAlert, ExternalLink, QrCode, Key, RefreshCw, Check } from 'lucide-react';

interface Props {
  installationId: string;
  isOpen: boolean;
  onActivated?: () => void;
  isOwnerOrManager?: boolean;
}

export const ExpiredLicenseModal: React.FC<Props> = ({
  installationId,
  isOpen,
  onActivated,
  isOwnerOrManager = true,
}) => {
  const { language } = useI18n();
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const externalRenewalUrl = `https://restos-crm-platform.vercel.app/renewal?installationId=${encodeURIComponent(
    installationId || ''
  )}`;

  const isFr = language === 'fr';

  const copy = {
    header: isFr ? 'Gardez votre service au top ! 🚀' : 'Keep Your Service at Its Best! 🚀',
    subHeadline: isFr
      ? 'Ne laissez pas une licence expirée ralentir votre salle et vos encaissements.'
      : "Don't let an expired license slow down your dining room and daily sales.",
    body: isFr
      ? "RestaurantOS permet à votre équipe de servir plus vite, d'éviter les erreurs en cuisine et de régaler vos clients. Renouvelez en 1 minute pour ne manquer aucune commande."
      : 'RestaurantOS helps your team serve faster, eliminate kitchen mistakes, and delight your guests. Renew in 1 minute so you don\'t miss a single order.',
    buttonText: isFr ? 'Renouveler mon abonnement →' : 'Renew My Subscription →',
    qrCaption: isFr ? 'Scannez pour renouveler sur votre téléphone' : 'Scan to renew on your phone',
    installationIdLabel: isFr ? 'ID Installation de votre caisse :' : 'Hub Installation ID:',
    enterCodeBtn: isFr ? 'J\'ai déjà une clé de licence' : 'I already have a license key',
    enterCodePlaceholder: isFr ? 'Collez votre clé de licence ici (ROS-L1...)' : 'Paste your license key here (ROS-L1...)',
    submitKeyBtn: isFr ? 'Activer la licence' : 'Activate License',
    copyIdSuccess: isFr ? 'ID Copié !' : 'ID Copied!',
  };

  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;

    setActivating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/licensing/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKeyInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || (isFr ? "Échec de l'activation" : 'Activation failed'));
      } else {
        setSuccessMsg(isFr ? 'Licence activée avec succès !' : 'License activated successfully!');
        setLicenseKeyInput('');
        setTimeout(() => {
          if (onActivated) onActivated();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || (isFr ? "Erreur lors de l'activation" : 'Activation error'));
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Top Header Warning */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 text-white flex items-center gap-3">
          <ShieldAlert className="w-7 h-7 shrink-0 text-white animate-bounce" />
          <div>
            <h2 className="text-xl font-black tracking-tight leading-tight">{copy.header}</h2>
            <p className="text-xs font-semibold text-amber-100">{copy.subHeadline}</p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto">
          {/* Main Copy Narrative */}
          <p className="text-gray-700 text-sm sm:text-base font-medium leading-relaxed bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80">
            {copy.body}
          </p>

          {/* Dual Column: Action Button & QR Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center pt-2">
            {/* Left Column: Direct Upgrade Link */}
            <div className="space-y-4">
              <a
                href={externalRenewalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-orange-600 hover:bg-orange-700 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-orange-600/20 hover:shadow-xl transition-all text-center cursor-pointer"
              >
                <span>{copy.buttonText}</span>
                <ExternalLink size={18} />
              </a>

              {/* Installation ID Reference */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  {copy.installationIdLabel}
                </span>
                <code className="text-xs font-mono font-bold text-gray-900 block truncate select-all">
                  {installationId || '—'}
                </code>
              </div>
            </div>

            {/* Right Column: QR Code */}
            <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-200 text-center">
              <div className="p-3 bg-white rounded-xl shadow-xs border border-gray-200 mb-2">
                <QRCodeSVG value={externalRenewalUrl} size={130} level="M" />
              </div>
              <span className="text-xs font-bold text-gray-700 flex items-center justify-center gap-1">
                <QrCode size={14} className="text-orange-600" />
                <span>{copy.qrCaption}</span>
              </span>
            </div>
          </div>

          {/* Key Input Toggle Form */}
          {isOwnerOrManager && (
            <div className="pt-4 border-t border-gray-200">
              {!showKeyInput ? (
                <button
                  type="button"
                  onClick={() => setShowKeyInput(true)}
                  className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Key size={15} />
                  <span>{copy.enterCodeBtn}</span>
                </button>
              ) : (
                <form onSubmit={handleActivateKey} className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                  {errorMsg && (
                    <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold">
                      {errorMsg}
                    </div>
                  )}
                  {successMsg && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-bold">
                      {successMsg}
                    </div>
                  )}
                  <textarea
                    rows={2}
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    placeholder={copy.enterCodePlaceholder}
                    className="w-full bg-white border border-gray-300 rounded-xl p-3 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowKeyInput(false)}
                      className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                    >
                      {isFr ? 'Annuler' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={activating || !licenseKeyInput.trim()}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {activating ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      <span>{copy.submitKeyBtn}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
