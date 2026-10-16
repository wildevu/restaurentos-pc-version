import React from 'react';
import { X, ShieldCheck, FileText, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n';

interface LegalDocsModalProps {
  type: 'PRIVACY' | 'TERMS' | null;
  onClose: () => void;
}

export const LegalDocsModal: React.FC<LegalDocsModalProps> = ({ type, onClose }) => {
  const { language } = useI18n();
  if (!type) return null;

  const isFr = language === 'fr';

  const privacyUrl = 'https://restos-crm-platform.vercel.app/privacy';
  const termsUrl = 'https://restos-crm-platform.vercel.app/terms';

  const isPrivacy = type === 'PRIVACY';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] border border-gray-200 shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isPrivacy ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : (
              <FileText className="w-6 h-6 text-blue-400" />
            )}
            <div>
              <h3 className="text-base font-black tracking-tight">
                {isPrivacy
                  ? isFr
                    ? 'Politique de Confidentialité — Offline'
                    : 'Privacy Policy — Offline'
                  : isFr
                  ? "Conditions Générales d'Utilisation — Offline"
                  : 'Terms of Service — Offline'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {isFr
                  ? 'Consultable hors-ligne sur votre caisse tactile'
                  : 'Available offline on your POS terminal'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 text-slate-800 text-xs sm:text-sm leading-relaxed space-y-4 font-sans">
          {isPrivacy ? (
            /* PRIVACY POLICY OFFLINE CONTENT */
            <>
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl font-bold text-xs">
                🔒 {isFr ? 'Souveraineté Locale :' : 'Local Sovereignty:'}{' '}
                {isFr
                  ? 'Vos données de caisse restent stockées en local sur votre ordinateur principal.'
                  : 'Your POS data stays stored locally on your main computer.'}
              </div>

              <h4 className="font-extrabold text-slate-900 text-base border-b pb-1">
                1. Engagement & Philosophie Offline-First
              </h4>
              <p>
                RestaurantOS est une solution de caisse enregistreuse tactile (POS) fonctionnant en
                réseau local (Local Hub). Toutes vos données opérationnelles (commandes, recettes,
                additions, comptes serveurs) sont stockées en local dans votre ordinateur. Aucune
                donnée de caisse n'est transmise automatiquement sans votre consentement.
              </p>

              <h4 className="font-extrabold text-slate-900 text-base border-b pb-1">
                2. Données Traitées lors de l'Export Analytics (.ros)
              </h4>
              <p>
                Lorsque vous exportez un fichier de rapport .ros pour analyse sur notre plateforme CRM (
                <code>https://restos-crm-platform.vercel.app</code>), nous compilons :
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>Chiffre d'affaires brut consolidé et quantités vendues par plat.</li>
                <li>Temps de rotation des tables et durée de préparation en cuisine.</li>
                <li>Identifiant d'installation du Hub (<code>inst_...</code>) et prénom des serveurs.</li>
              </ul>
              <p className="font-bold text-slate-900">
                ⚠️ Le fichier .ros ne contient AUCUNE donnée bancaire ni coordonnée de client final.
              </p>

              <h4 className="font-extrabold text-slate-900 text-base border-b pb-1">
                3. Conservation & Finalité
              </h4>
              <p>
                Les données transmises servent exclusivement à générer votre Rapport Audit
                Consultant Expert (PDF) et votre tableau de bord interactif. Vos données ne sont
                jamais vendues ou cédées à des tiers.
              </p>
            </>
          ) : (
            /* TERMS OF SERVICE OFFLINE CONTENT */
            <>
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl font-bold text-xs">
                📜 {isFr ? 'Conditions de Licence :' : 'Licensing Terms:'}{' '}
                {isFr
                  ? 'RestaurantOS est exploité sous licence logicielle hors-ligne.'
                  : 'RestaurantOS operates under an offline software license.'}
              </div>

              <h4 className="font-extrabold text-slate-900 text-base border-b pb-1">
                1. Octroi de Licence & Durée
              </h4>
              <p>
                RestaurantOS vous accorde une licence d'utilisation non exclusive pour exploiter le
                logiciel sur votre matériel local. La durée est déterminée par votre clé d'activation
                (<code>ROS-L1....</code>). En cas de renouvellement anticipé, les jours restants sont
                automatiquement cumulés.
              </p>

              <h4 className="font-extrabold text-slate-900 text-base border-b pb-1">
                2. Responsabilité du Matériel Local
              </h4>
              <p>
                Le restaurateur est responsable du maintien en bon état de son matériel informatique
                local (PC caisse, disques durs, Wi-Fi local). RestaurantOS intègre des outils de
                sauvegarde automatique localisés dans <code>C:\ProgramData\RestaurantOS\</code>.
              </p>

              <h4 className="font-extrabold text-slate-900 text-base border-b pb-1">
                3. Module Consultant Expert
              </h4>
              <p>
                Les analyses de rentabilité et classements de menu fournis par le Module Consultant sont
                des outils d'aide à la décision. Le restaurateur reste seul maître de la fixation de ses
                prix et de la gestion de son établissement.
              </p>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-gray-200 flex items-center justify-between">
          <a
            href={isPrivacy ? privacyUrl : termsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <span>
              {isFr ? 'Consulter la version web en ligne' : 'View online web version'}
            </span>
            <ExternalLink size={12} />
          </a>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            {isFr ? 'Fermer' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
