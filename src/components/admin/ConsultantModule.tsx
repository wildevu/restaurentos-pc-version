import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Briefcase,
  Download,
  ExternalLink,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  TrendingUp,
  XCircle,
  Clock,
  QrCode
} from 'lucide-react';
import { LegalDocsModal } from '../LegalDocsModal';
import { useI18n } from '../../i18n';

interface ConsultantModuleProps {
  authToken?: string;
}

export const ConsultantModule: React.FC<ConsultantModuleProps> = ({ authToken }) => {
  const { language } = useI18n();
  const isFr = language === 'fr';

  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30);
  const [downloading, setDownloading] = useState(false);
  const [legalDocType, setLegalDocType] = useState<'PRIVACY' | 'TERMS' | null>(null);

  const copy = isFr
    ? {
        loading: 'Chargement du module Consultant...',
        title: 'Module Consultant Expert',
        premiumActive: 'PREMIUM ACTIF',
        standardPlan: 'OFFRE STANDARD',
        subtitle: "Analyse des performances, étude des coûts enregistrés et recommandations opérationnelles.",
        selectPeriod: "Étape 1 : Sélectionnez la période d'analyse",
        period7: '7 derniers jours',
        period7Desc: 'Analyse rapide de la semaine écoulée',
        period30: '30 derniers jours',
        period30Desc: 'Bilan mensuel et tendances (recommandé)',
        period90: '90 derniers jours',
        period90Desc: 'Bilan trimestriel et tendances de fond',
        localNoticeTitle: 'Le rapport est téléchargé localement',
        localNotice: "RestaurantOS génère le fichier .ros depuis le Hub Local et le navigateur le télécharge sur cet appareil. Le fichier n'est pas envoyé automatiquement à Restos CRM ni à un autre service externe. Le téléversement vers Restos CRM est une action distincte et facultative que vous effectuez vous-même.",
        reportContents: "Le rapport peut contenir des données de ventes, des articles et coûts du menu, des statistiques de personnel, des identifiants du restaurant et de l'installation, des horodatages ainsi que des diagnostics techniques. Certains messages de diagnostic peuvent inclure des adresses IP locales, des chemins système ou des détails d'appareil. Vérifiez le fichier avant de le partager.",
        privacy: 'Politique de confidentialité',
        terms: "Conditions d'utilisation",
        generate: 'Créer et télécharger le rapport (.ros)',
        generating: 'Génération du rapport...',
        openCrm: 'Ouvrir Restos CRM (facultatif)',
        downloadFailed: 'Échec du téléchargement du rapport.',
        downloadError: "Erreur lors de l'export : ",
        deliveryTitle: 'Après le téléversement',
        deliveryNotice: "Après avoir téléversé volontairement le fichier .ros sur Restos CRM, le rapport Consultant et le tableau de bord sont préparés selon les modalités du service CRM. La génération locale du fichier ne déclenche pas cet envoi.",
        glossaryTitle: 'Comprendre vos indicateurs',
        aovTitle: 'Panier moyen (AOV) :',
        aovDesc: 'Valeur moyenne des articles enregistrés par session de table clôturée. Ce montant ne confirme pas un paiement encaissé.',
        revpashTitle: 'RevPASH :',
        revpashDesc: "Valeur des ventes enregistrées par siège disponible et par heure, selon les données de capacité et d'horodatage disponibles.",
        prepTitle: 'Temps de préparation :',
        prepDesc: "Durée entre l'enregistrement d'un article et son premier statut « prêt » en cuisine, lorsque les horodatages existent.",
        menuCategories: 'Catégories de menu',
        stars: 'Plats populaires et à forte marge enregistrée.',
        plowhorses: 'Plats populaires mais à faible marge enregistrée.',
        puzzles: 'Plats à forte marge enregistrée mais moins commandés.',
        dogs: 'Plats peu commandés et à faible marge enregistrée.',
        premiumAccess: 'ACCÈS RÉSERVÉ : MODULE CONSULTANT EXPERT (OFFRE PREMIUM)',
        losingMoney: 'Vous pouvez passer à côté de possibilités d’amélioration.',
        salesRecorded: "Votre caisse enregistre les opérations. L'analyse peut vous aider à mieux comprendre les ventes, les coûts saisis et l'activité de votre équipe.",
        missedTitle: 'Points à examiner :',
        missed1: 'Des plats populaires dont le coût enregistré réduit la marge.',
        missed2: 'Des différences de volume entre les membres de votre équipe.',
        missed3: 'Des périodes de faible activité qui méritent une analyse.',
        solutionTitle: "La solution : l'offre Premium",
        solutionDesc: "Le Consultant Expert analyse les données exportées et prépare des observations et recommandations. Vérifiez les données et tenez compte du contexte de votre établissement avant toute décision.",
        guaranteeTitle: 'NOTRE ENGAGEMENT :',
        guaranteeDesc: "Les analyses sont des outils d'aide à la décision fondés sur les données du rapport. Elles ne constituent ni une garantie de résultat financier ni un audit comptable.",
        upgrade: "PASSER À L'OFFRE PREMIUM",
        scanPhone: 'Scanner avec un téléphone',
        scanUpgrade: "Scannez pour consulter l'offre Premium depuis votre smartphone."
      }
    : {
        loading: 'Loading Consultant module...',
        title: 'Expert Consultant Module',
        premiumActive: 'PREMIUM ACTIVE',
        standardPlan: 'STANDARD PLAN',
        subtitle: 'Performance analysis, recorded-cost review and operational recommendations.',
        selectPeriod: 'Step 1: Select the analysis period',
        period7: 'Last 7 days',
        period7Desc: 'A quick review of the past week',
        period30: 'Last 30 days',
        period30Desc: 'Monthly review and trends (recommended)',
        period90: 'Last 90 days',
        period90Desc: 'Quarterly review and longer-term trends',
        localNoticeTitle: 'The report is downloaded locally',
        localNotice: 'RestaurantOS generates the .ros file through the Local Hub and the browser downloads it to this device. The file is not automatically sent to Restos CRM or another external service. Uploading it to Restos CRM is a separate, optional action that you initiate yourself.',
        reportContents: 'The report may contain sales data, menu items and recorded costs, staff statistics, restaurant and installation identifiers, timestamps, and technical diagnostics. Some diagnostic messages may include local IP addresses, system paths, or device details. Review the file before sharing it.',
        privacy: 'Privacy Policy',
        terms: 'Terms of Use',
        generate: 'Generate & download report (.ros)',
        generating: 'Generating report...',
        openCrm: 'Open Restos CRM (optional)',
        downloadFailed: 'The report could not be downloaded.',
        downloadError: 'Export error: ',
        deliveryTitle: 'After upload',
        deliveryNotice: 'After you voluntarily upload the .ros file to Restos CRM, the Consultant report and dashboard are prepared under the CRM service terms. Generating the local file does not trigger that upload.',
        glossaryTitle: 'Understanding your metrics',
        aovTitle: 'Average order value (AOV):',
        aovDesc: 'Average recorded item value per closed table session. This does not confirm that payment was collected.',
        revpashTitle: 'RevPASH:',
        revpashDesc: 'Recorded sales value per available seat per hour, based on the capacity and timestamp data available.',
        prepTitle: 'Preparation time:',
        prepDesc: 'Time between an item being recorded and its first kitchen-ready status, where timestamps are available.',
        menuCategories: 'Menu categories',
        stars: 'Popular items with a high recorded margin.',
        plowhorses: 'Popular items with a low recorded margin.',
        puzzles: 'Items with a high recorded margin but fewer orders.',
        dogs: 'Items with fewer orders and a low recorded margin.',
        premiumAccess: 'EXPERT CONSULTANT MODULE — PREMIUM ACCESS',
        losingMoney: 'There may be opportunities to improve your operation.',
        salesRecorded: 'Your POS records operational activity. Analysis can help you better understand sales, recorded costs and team activity.',
        missedTitle: 'Areas to review:',
        missed1: 'Popular items whose recorded costs reduce their margin.',
        missed2: 'Differences in activity across team members.',
        missed3: 'Periods of low activity that may deserve further analysis.',
        solutionTitle: 'The solution: Premium',
        solutionDesc: 'The Expert Consultant analyses the exported data and prepares observations and recommendations. Review the data and consider your restaurant context before making decisions.',
        guaranteeTitle: 'IMPORTANT:',
        guaranteeDesc: 'These analyses are decision-support tools based on the report data. They are not a guarantee of financial results or a formal accounting audit.',
        upgrade: 'EXPLORE PREMIUM',
        scanPhone: 'Scan with your phone',
        scanUpgrade: 'Scan to explore the Premium plan on your smartphone.'
      };

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

  const isPremium =
    licenseStatus?.status === 'ACTIVE' &&
    licenseStatus?.canOperate &&
    licenseStatus?.licenseType === 'PREMIUM';

  const handleDownloadRosReport = async () => {
    try {
      setDownloading(true);
      const res = await fetch(`/api/admin/reports/export-ros?days=${selectedPeriod}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (!res.ok) {
        let message = copy.downloadFailed;
        try {
          const data = await res.json();
          if (typeof data?.error === 'string' && data.error.trim()) {
            message = data.error;
          }
        } catch {
          // Keep the localized fallback when the response is not JSON.
        }
        alert(message);
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
      const detail = err instanceof Error ? err.message : '';
      alert(copy.downloadError + detail);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-medium">
        {copy.loading}
      </div>
    );
  }

  const periods = [
    { days: 7, label: copy.period7, desc: copy.period7Desc },
    { days: 30, label: copy.period30, desc: copy.period30Desc },
    { days: 90, label: copy.period90, desc: copy.period90Desc }
  ];

  return (
    <div className="space-y-6">
      <LegalDocsModal type={legalDocType} onClose={() => setLegalDocType(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-gray-900">{copy.title}</h2>
            {isPremium ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} /> {copy.premiumActive}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gray-100 text-gray-700 uppercase tracking-wider">
                {copy.standardPlan}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{copy.subtitle}</p>
        </div>
      </div>

      {isPremium ? (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              {copy.selectPeriod}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {periods.map((period) => (
                <button
                  key={period.days}
                  type="button"
                  onClick={() => setSelectedPeriod(period.days)}
                  aria-pressed={selectedPeriod === period.days}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedPeriod === period.days
                      ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-black ${
                      selectedPeriod === period.days ? 'text-purple-900' : 'text-gray-900'
                    }`}>
                      {period.label}
                    </span>
                    <input
                      type="radio"
                      name="period"
                      checked={selectedPeriod === period.days}
                      onChange={() => setSelectedPeriod(period.days)}
                      aria-label={period.label}
                      className="accent-purple-600"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{period.desc}</p>
                </button>
              ))}
            </div>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2 text-xs text-emerald-950">
              <div className="flex items-center gap-2 font-bold text-sm">
                <ShieldCheck size={17} className="shrink-0" />
                {copy.localNoticeTitle}
              </div>
              <p>{copy.localNotice}</p>
              <p>{copy.reportContents}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLegalDocType('PRIVACY')}
                  className="font-bold underline text-emerald-900 hover:text-emerald-700"
                >
                  {copy.privacy}
                </button>
                <button
                  type="button"
                  onClick={() => setLegalDocType('TERMS')}
                  className="font-bold underline text-emerald-900 hover:text-emerald-700"
                >
                  {copy.terms}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-4">
              <button
                type="button"
                onClick={handleDownloadRosReport}
                disabled={downloading}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-black text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <Download size={18} />
                <span>{downloading ? copy.generating : copy.generate}</span>
              </button>

              <a
                href={uploadUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <ExternalLink size={18} />
                <span>{copy.openCrm}</span>
              </a>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-xs text-purple-900 leading-relaxed font-medium">
              <strong>{copy.deliveryTitle}: </strong>
              {copy.deliveryNotice}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              {copy.glossaryTitle}
            </h3>

            <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
              <div>
                <strong className="text-gray-900 block">{copy.aovTitle}</strong>
                {copy.aovDesc}
              </div>
              <div>
                <strong className="text-gray-900 block">{copy.revpashTitle}</strong>
                {copy.revpashDesc}
              </div>
              <div>
                <strong className="text-gray-900 block">{copy.prepTitle}</strong>
                {copy.prepDesc}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 space-y-2 text-xs">
              <strong className="text-gray-900 block mb-2">{copy.menuCategories}</strong>
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <strong className="text-amber-900">⭐ STARS:</strong> {copy.stars}
              </div>
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <strong className="text-blue-900">🐴 PLOWHORSES:</strong> {copy.plowhorses}
              </div>
              <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                <strong className="text-purple-900">🧩 PUZZLES:</strong> {copy.puzzles}
              </div>
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                <strong className="text-red-900">🐶 DOGS:</strong> {copy.dogs}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-zinc-900 to-purple-950 text-white p-6 sm:p-8 rounded-2xl border border-purple-500/30 shadow-2xl space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-wider">
                <Briefcase size={14} />
                {copy.premiumAccess}
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {copy.losingMoney}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{copy.salesRecorded}</p>
            </div>

            <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-2.5 text-xs text-zinc-200">
              <span className="font-bold text-red-400 block uppercase tracking-wider text-[11px]">
                {copy.missedTitle}
              </span>
              {[copy.missed1, copy.missed2, copy.missed3].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4 space-y-1 text-xs text-purple-100">
              <strong className="text-purple-300 font-bold flex items-center gap-1.5 text-sm">
                <TrendingUp size={16} /> {copy.solutionTitle}
              </strong>
              <p className="leading-relaxed text-zinc-300">{copy.solutionDesc}</p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200 leading-relaxed">
                <strong className="text-amber-400 block font-bold mb-0.5">{copy.guaranteeTitle}</strong>
                {copy.guaranteeDesc}
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <a
                href={upgradeUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-black text-sm rounded-xl shadow-lg hover:shadow-purple-500/25 transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🚀 {copy.upgrade}</span>
              </a>

              <div className="flex items-center gap-3 bg-white/10 border border-white/15 p-3 rounded-xl shrink-0 w-full sm:w-auto">
                <div className="bg-white p-1.5 rounded-lg shrink-0">
                  <QRCodeSVG value={upgradeUrl} size={64} level="M" />
                </div>
                <div className="text-[11px] text-zinc-300 leading-tight">
                  <strong className="text-white font-bold block mb-1 flex items-center gap-1">
                    <QrCode size={12} /> {copy.scanPhone}
                  </strong>
                  {copy.scanUpgrade}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
