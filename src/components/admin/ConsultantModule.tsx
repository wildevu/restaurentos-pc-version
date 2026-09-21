import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Briefcase,
  Download,
  ExternalLink,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode
} from 'lucide-react';

interface ConsultantModuleProps {
  authToken?: string;
}

export const ConsultantModule: React.FC<ConsultantModuleProps> = ({ authToken }) => {
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30); // 7, 30, or 90 days
  const [downloading, setDownloading] = useState(false);

  const upgradeUrl = 'https://restos-crm-platform.vercel.app/upgrade';
  const uploadUrl = 'https://restos-crm-platform.vercel.app/upload';

  useEffect(() => {
    fetchLicenseStatus();
  }, [authToken]);

  const fetchLicenseStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/licensing/status');
      if (res.ok) {
        const data = await res.json();
        setLicenseStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch licensing status', err);
    } finally {
      setLoading(false);
    }
  };

  const isPremium = licenseStatus?.status === 'ACTIVE' && licenseStatus?.canOperate && licenseStatus?.licenseType === 'PREMIUM';

  const handleDownloadRosReport = async () => {
    try {
      setDownloading(true);
      const res = await fetch(`/api/admin/reports/export-ros?days=${selectedPeriod}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to download report.');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `restaurantos_export_${selectedPeriod}days_${new Date().toISOString().slice(0, 10)}.ros`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Error exporting report: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-medium">
        Loading Consultant Module...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-gray-900">Module Consultant Expert</h2>
            {isPremium ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} /> PREMIUM ACTIVE
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gray-100 text-gray-700 uppercase tracking-wider">
                STANDARD PLAN
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Analyse intelligente de performance, audit de rentabilité et recommandations de marge.
          </p>
        </div>
      </div>

      {isPremium ? (
        /* ========================================================================= */
        /* CASE A: PREMIUM LICENSE ACTIVE INTERFACE                                 */
        /* ========================================================================= */
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              Étape 1 : Sélectionnez la Période d'Analyse Rétroactive
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { days: 7, label: '7 Derniers Jours', desc: 'Analyse rapide de la semaine écoulée' },
                { days: 30, label: '30 Derniers Jours', desc: 'Bilan mensuel complet & rentabilité (Recommandé)' },
                { days: 90, label: '90 Derniers Jours', desc: 'Bilan trimestriel & tendances de fond' },
              ].map((p) => (
                <button
                  key={p.days}
                  onClick={() => setSelectedPeriod(p.days)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedPeriod === p.days
                      ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-black ${selectedPeriod === p.days ? 'text-purple-900' : 'text-gray-900'}`}>
                      {p.label}
                    </span>
                    <input
                      type="radio"
                      name="period"
                      checked={selectedPeriod === p.days}
                      onChange={() => setSelectedPeriod(p.days)}
                      className="accent-purple-600"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{p.desc}</p>
                </button>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={handleDownloadRosReport}
                disabled={downloading}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download size={18} />
                <span>{downloading ? 'Génération du Fichier .ros...' : '📊 Créer le Rapport (.ros)'}</span>
              </button>

              <a
                href={uploadUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <ExternalLink size={18} />
                <span>🌐 Ouvrir la Plateforme Expert</span>
              </a>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-xs text-purple-900 leading-relaxed font-medium">
              <strong>Notice de Livraison :</strong> Votre Rapport Expert PDF et votre Tableau de bord web interactif vous seront envoyés directement par WhatsApp et par Email sous 24 heures après dépôt du fichier .ros sur la plateforme.
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* CASE B: STANDARD LICENSE UPSELL CARD + GLOSSARY                          */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top-Left Glossary & Metric Notes */}
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              Comprendre vos Indicateurs (Lexique)
            </h3>

            <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
              <div>
                <strong className="text-gray-900 block">• Panier Moyen (AOV) :</strong>
                Montant moyen dépensé par chaque table servie.
              </div>
              <div>
                <strong className="text-gray-900 block">• RevPASH :</strong>
                Chiffre d'affaires généré par chaque siège disponible par heure d'ouverture.
              </div>
              <div>
                <strong className="text-gray-900 block">• Temps de Préparation :</strong>
                Durée moyenne entre la commande du serveur et la confirmation cuisine.
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 space-y-2 text-xs">
              <strong className="text-gray-900 block mb-2">🍔 Les 4 Catégories de votre Menu :</strong>
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <strong className="text-amber-900">⭐ STARS :</strong> Plats très populaires et très rentables (Vos meilleurs succès).
              </div>
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <strong className="text-blue-900">🐴 PLOWHORSES :</strong> Plats très populaires mais faible marge (À réévaluer).
              </div>
              <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                <strong className="text-purple-900">🧩 PUZZLES :</strong> Plats très rentables mais peu commandés (À conseiller).
              </div>
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                <strong className="text-red-900">🐶 DOGS :</strong> Plats peu commandés et faible marge (À retirer).
              </div>
            </div>
          </div>

          {/* Main Marketing Upsell Card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-zinc-900 to-purple-950 text-white p-6 sm:p-8 rounded-2xl border border-purple-500/30 shadow-2xl space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider">
                <Briefcase size={14} />
                ACCÈS RÉSERVÉ : MODULE CONSULTANT EXPERT (PLAN PREMIUM)
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Vous perdez de l'argent chaque jour sans le savoir.
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Votre caisse enregistre bien vos ventes. Mais personne n'analyse vos chiffres pour augmenter vos bénéfices.
              </p>
            </div>

            {/* Missed Opportunities List */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-2.5 text-xs text-zinc-200">
              <span className="font-bold text-red-400 block uppercase tracking-wider text-[11px]">
                ❌ Ce que vous ratez en ce moment :
              </span>
              <div className="flex items-start gap-2">
                <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>Des plats très populaires qui ne vous rapportent rien à cause d'un coût trop élevé.</span>
              </div>
              <div className="flex items-start gap-2">
                <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>Des serveurs qui sous-performent par manque de suivi et de motivation.</span>
              </div>
              <div className="flex items-start gap-2">
                <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>Des heures creuses mal exploitées qui augmentent vos frais de personnel.</span>
              </div>
            </div>

            {/* Solution Description */}
            <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4 space-y-1 text-xs text-purple-100">
              <strong className="text-purple-300 font-bold flex items-center gap-1.5 text-sm">
                <TrendingUp size={16} /> La solution : Le Plan Premium
              </strong>
              <p className="leading-relaxed text-zinc-300">
                Active un Consultant Expert dans votre caisse. En 1 clic, notre système analyse vos ventes. Vous recevez un audit complet sous 24h pour corriger vos prix et booster vos marges.
              </p>
            </div>

            {/* Guarantee */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200 leading-relaxed">
                <strong className="text-amber-400 block font-bold mb-0.5">🛡️ NOTRE GARANTIE UNIQUE :</strong>
                Si votre premier rapport ne vous montre pas au moins 3 actions concrètes pour récupérer 3 fois le prix de cet abonnement, nous vous remboursons intégralement. Vous ne prenez aucun risque.
              </div>
            </div>

            {/* CTA Buttons & QR Code Container */}
            <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <a
                href={upgradeUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-black text-sm rounded-xl shadow-lg hover:shadow-purple-500/25 transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🚀 PASSER AU PLAN PREMIUM — ACTIVER EN 1 CLIC</span>
              </a>

              {/* QR Code Option for Phone Scanning */}
              <div className="flex items-center gap-3 bg-white/10 border border-white/15 p-3 rounded-xl shrink-0 w-full sm:w-auto">
                <div className="bg-white p-1.5 rounded-lg shrink-0">
                  <QRCodeSVG value={upgradeUrl} size={64} level="M" />
                </div>
                <div className="text-[11px] text-zinc-300 leading-tight">
                  <strong className="text-white font-bold block mb-1 flex items-center gap-1">
                    <QrCode size={12} /> Scan Téléphone
                  </strong>
                  Scannez pour passer au Plan Premium depuis votre smartphone.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
