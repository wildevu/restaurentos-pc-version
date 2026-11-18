import React from 'react';
import { X, ShieldCheck, FileText, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n';

interface LegalDocsModalProps {
  type: 'PRIVACY' | 'TERMS' | null;
  onClose: () => void;
}

type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const LegalDocsModal: React.FC<LegalDocsModalProps> = ({ type, onClose }) => {
  const { language } = useI18n();
  if (!type) return null;

  const isFr = language === 'fr';
  const isPrivacy = type === 'PRIVACY';

  const privacySections: LegalSection[] = isFr
    ? [
        {
          title: '1. Fonctionnement local de RestaurantOS',
          paragraphs: [
            "RestaurantOS est un logiciel de caisse fonctionnant autour d'un Hub Local. Les données opérationnelles nécessaires au fonctionnement du POS sont conservées dans la base de données du PC Hub et synchronisées avec les appareils autorisés sur le réseau local.",
            "La génération d'un fichier .ros utilise le Hub Local et déclenche le téléchargement du fichier par le navigateur. Cette opération ne téléverse pas automatiquement le fichier vers Restos CRM et ne le transmet pas automatiquement à un autre service externe."
          ]
        },
        {
          title: '2. Informations pouvant figurer dans un rapport .ros',
          paragraphs: ['Selon la période sélectionnée et les données disponibles, le rapport peut contenir :'],
          bullets: [
            'Totaux et volumes de ventes enregistrés, répartition par article, catégorie, jour et heure.',
            'Noms des articles, prix de vente et coûts enregistrés ou historiques.',
            "Statistiques d'activité attribuées aux membres du personnel, notamment leurs noms ou pseudonymes.",
            "Nom du restaurant, devise, fuseau horaire, capacité, identifiants du restaurant et de l'installation.",
            "Horodatages opérationnels et diagnostics techniques : événements, avertissements, erreurs, versions ou informations d'appareil."
          ]
        },
        {
          title: '3. Diagnostics techniques et partage',
          paragraphs: [
            "Les journaux peuvent contenir des détails techniques tels que des adresses IP locales, chemins de fichiers Windows, noms d'appareil ou extraits de messages d'erreur. Des mécanismes de masquage sont appliqués à certaines valeurs, mais ils ne garantissent pas la suppression de tout identifiant ou de toute information sensible.",
            "Avant de transmettre un fichier .ros à une personne ou à un service externe, examinez son contenu et assurez-vous que vous êtes autorisé à partager les informations relatives à votre établissement et à votre personnel."
          ]
        },
        {
          title: '4. Téléversement facultatif vers Restos CRM',
          paragraphs: [
            "Le téléversement vers Restos CRM est une opération séparée, facultative et initiée par l'utilisateur depuis la plateforme CRM. Ce n'est qu'après cette action que les données du fichier sont transmises au service CRM pour les finalités décrites dans sa propre politique de confidentialité.",
            "Restos CRM est un service distinct de l'application locale RestaurantOS. Les conditions de traitement, la conservation, les accès et les demandes de suppression relatives aux fichiers téléversés sont présentés dans les documents de confidentialité et d'utilisation de Restos CRM. Consultez-les avant le téléversement."
          ]
        },
        {
          title: '5. Contrôle des données et contact',
          paragraphs: [
            "Les données POS conservées localement restent sous le contrôle de l'établissement qui exploite le PC Hub, sous réserve des obligations légales applicables. Les fichiers .ros téléchargés restent dans l'emplacement de téléchargement choisi par le navigateur jusqu'à leur déplacement ou suppression par l'utilisateur.",
            "L'établissement doit informer son personnel de l'utilisation de données professionnelles permettant d'attribuer des opérations ou des statistiques à des membres de l'équipe."
          ]
        }
      ]
    : [
        {
          title: '1. How RestaurantOS operates locally',
          paragraphs: [
            'RestaurantOS is a point-of-sale application built around a Local Hub. Operational data needed by the POS is kept in the Hub PC database and synchronized with authorized devices on the local network.',
            'Generating a .ros file uses the Local Hub and causes the browser to download the file. This does not automatically upload the file to Restos CRM or automatically send it to another external service.'
          ]
        },
        {
          title: '2. Information that may appear in a .ros report',
          paragraphs: ['Depending on the selected period and the data available, a report may contain:'],
          bullets: [
            'Recorded sales totals and volumes, broken down by item, category, day and hour.',
            'Menu item names, selling prices, and recorded or historical costs.',
            'Staff activity statistics attributed to team members, including names or pseudonyms.',
            'Restaurant name, currency, timezone, capacity, and restaurant or installation identifiers.',
            'Operational timestamps and technical diagnostics, including events, warnings, errors, versions or device information.'
          ]
        },
        {
          title: '3. Technical diagnostics and sharing',
          paragraphs: [
            'Logs may contain technical details such as local IP addresses, Windows file paths, device names or excerpts from error messages. Some values are redacted, but redaction does not guarantee that every identifier or sensitive detail is removed.',
            'Before sending a .ros file to another person or external service, review its contents and make sure you are authorized to share information about your restaurant and staff.'
          ]
        },
        {
          title: '4. Optional upload to Restos CRM',
          paragraphs: [
            'Uploading to Restos CRM is a separate, optional action initiated by the user on the CRM platform. Only after that action are the file data transmitted to the CRM service for the purposes described in its own privacy notice.',
            'Restos CRM is a service separate from the local RestaurantOS application. Processing, retention, access and deletion terms for uploaded files are described in Restos CRM’s own privacy and service terms. Review those documents before uploading.'
          ]
        },
        {
          title: '5. Data control and contact',
          paragraphs: [
            'POS data stored locally remains under the control of the establishment operating the Hub PC, subject to applicable legal requirements. Downloaded .ros files remain in the browser-selected download location until the user moves or deletes them.',
            'The establishment is responsible for informing staff about the use of work-related data that attributes activities or statistics to team members.'
          ]
        }
      ];

  const termsSections: LegalSection[] = isFr
    ? [
        {
          title: '1. Objet et licence',
          paragraphs: [
            "Les présentes conditions encadrent l'utilisation du logiciel RestaurantOS comme système de caisse et d'exploitation local pour restaurants. La licence accordée est non exclusive, non transférable et limitée à l'installation et à la durée prévues par la clé de licence fournie.",
            "Les fonctions disponibles peuvent varier selon le type et l'état de la licence. Les services en ligne, dont Restos CRM, constituent des services distincts et peuvent être soumis à leurs propres conditions."
          ]
        },
        {
          title: "2. Données et responsabilités de l'établissement",
          paragraphs: [
            "L'établissement conserve les droits qu'il détient sur ses données commerciales et opérationnelles. Il est responsable de l'exactitude des informations saisies, de la gestion des comptes et autorisations du personnel, ainsi que du respect des obligations applicables concernant les données de ses employés.",
            "L'établissement doit protéger l'accès au PC Hub, aux comptes propriétaires et gestionnaires, au réseau local et aux sauvegardes. Les comptes individuels ne doivent pas être partagés sans nécessité."
          ]
        },
        {
          title: '3. Matériel, réseau et sauvegardes',
          paragraphs: [
            "RestaurantOS dépend du matériel, du système Windows, de l'alimentation électrique et du réseau local exploités par le restaurant. Des coupures ou défaillances de ces éléments peuvent interrompre temporairement le service ou la synchronisation.",
            "Les outils de sauvegarde intégrés sont une aide et ne remplacent pas une stratégie de sauvegarde indépendante. L'établissement doit vérifier périodiquement ses sauvegardes et conserver des copies protégées, séparées du PC principal."
          ]
        },
        {
          title: '4. Rapports .ros et limites des analyses',
          paragraphs: [
            "La création d'un rapport .ros produit un fichier téléchargé localement. Elle n'autorise pas et ne déclenche pas automatiquement sa transmission vers Restos CRM. Tout téléversement doit être initié séparément par l'utilisateur sur la plateforme CRM.",
            "Les rapports présentent des données opérationnelles enregistrées. Les montants bruts des articles ne constituent pas une preuve d'encaissement, un relevé bancaire, un chiffre d'affaires comptable certifié ou un bénéfice net. Les coûts, marges et indicateurs dépendent de la qualité et de la couverture des données saisies.",
            "Les analyses et recommandations du Consultant sont des outils d'aide à la décision et ne remplacent pas les conseils d'un expert-comptable, d'un conseiller financier ou d'un professionnel qualifié."
          ]
        },
        {
          title: '5. Utilisation autorisée et disponibilité',
          paragraphs: [
            "L'utilisateur s'engage à utiliser le logiciel conformément à la loi, à ne pas tenter de contourner le système de licence ni d'accéder sans autorisation aux données d'autrui, et à maintenir les appareils autorisés sous son contrôle.",
            "RestaurantOS est fourni selon les fonctionnalités disponibles et peut être mis à jour. Aucune disponibilité ininterrompue ne peut être garantie lorsque le service dépend du matériel ou du réseau local du restaurant."
          ]
        },
        {
          title: '6. Responsabilité et contact',
          paragraphs: [
            "Dans les limites permises par le droit applicable, l'établissement demeure responsable de ses décisions opérationnelles, de la protection de ses données et de son environnement matériel. Aucune disposition des présentes conditions n'exclut les droits ou garanties qui ne peuvent légalement être exclus.",
            "Pour toute question relative au logiciel, contactez support@restos-crm-platform.com. Les services Restos CRM disposent de conditions distinctes."
          ]
        }
      ]
    : [
        {
          title: '1. Purpose and license',
          paragraphs: [
            'These terms govern the use of RestaurantOS as a local restaurant point-of-sale and operations system. The license granted is non-exclusive, non-transferable, and limited to the installation and term specified by the supplied license key.',
            'Available features may vary according to license type and status. Online services, including Restos CRM, are separate services and may be governed by their own terms.'
          ]
        },
        {
          title: '2. Restaurant data and responsibilities',
          paragraphs: [
            'The establishment retains the rights it holds in its business and operational data. It is responsible for the accuracy of information entered, management of staff accounts and permissions, and compliance with applicable obligations relating to employee data.',
            'The establishment must protect access to the Hub PC, owner and manager accounts, local network and backups. Individual accounts should not be shared unnecessarily.'
          ]
        },
        {
          title: '3. Hardware, network and backups',
          paragraphs: [
            'RestaurantOS depends on the hardware, Windows environment, power supply and local network operated by the restaurant. Failures or interruptions affecting these components may temporarily interrupt service or synchronization.',
            'Built-in backup tools are an aid and do not replace an independent backup strategy. The establishment should periodically verify backups and keep protected copies separate from the primary PC.'
          ]
        },
        {
          title: '4. .ros reports and analysis limitations',
          paragraphs: [
            'Creating a .ros report produces a file downloaded locally. It does not authorize or automatically trigger transmission to Restos CRM. Any upload must be initiated separately by the user on the CRM platform.',
            'Reports show recorded operational data. Gross recorded item amounts are not proof of payment collection, a bank statement, certified accounting revenue or net profit. Costs, margins and metrics depend on the quality and coverage of entered data.',
            'Consultant analysis and recommendations are decision-support tools and do not replace advice from an accountant, financial adviser or other qualified professional.'
          ]
        },
        {
          title: '5. Acceptable use and availability',
          paragraphs: [
            'Users agree to use the software lawfully, not to bypass the licensing system or access another party’s data without authorization, and to keep authorized devices under their control.',
            'RestaurantOS is provided with the features available at the time and may be updated. Continuous availability cannot be guaranteed when service depends on the restaurant’s hardware or local network.'
          ]
        },
        {
          title: '6. Liability and contact',
          paragraphs: [
            'To the extent permitted by applicable law, the establishment remains responsible for its operational decisions, data protection and hardware environment. Nothing in these terms excludes rights or warranties that cannot legally be excluded.',
            'For software-related questions, contact support@restos-crm-platform.com. Restos CRM services have separate terms.'
          ]
        }
      ];

  const sections = isPrivacy ? privacySections : termsSections;
  const callout = isPrivacy
    ? isFr
      ? "Le téléchargement d'un fichier .ros reste local. Aucun téléversement automatique vers Restos CRM n'est déclenché."
      : 'Downloading a .ros file is a local operation. No automatic upload to Restos CRM is triggered.'
    : isFr
      ? "Le téléversement d'un rapport vers Restos CRM est distinct et doit être initié par l'utilisateur."
      : 'Uploading a report to Restos CRM is separate and must be initiated by the user.';

  const externalUrl = isPrivacy
    ? 'https://restos-crm-platform.vercel.app/privacy'
    : 'https://restos-crm-platform.vercel.app/terms';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-docs-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] border border-gray-200 shadow-2xl overflow-hidden flex flex-col my-auto">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {isPrivacy ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : (
              <FileText className="w-6 h-6 text-blue-400 shrink-0" />
            )}
            <div className="min-w-0">
              <h3 id="legal-docs-title" className="text-base font-black tracking-tight">
                {isPrivacy
                  ? isFr ? 'Politique de confidentialité' : 'Privacy Policy'
                  : isFr ? "Conditions d'utilisation" : 'Terms of Use'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {isFr ? 'Version consultable hors ligne' : 'Offline version'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isFr ? 'Fermer' : 'Close'}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 sm:p-8 overflow-y-auto flex-1 text-slate-800 text-xs sm:text-sm leading-relaxed space-y-5 font-sans">
          <div className={`p-3 rounded-2xl font-bold text-xs ${
            isPrivacy
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-blue-50 border border-blue-200 text-blue-900'
          }`}>
            {isPrivacy ? <ShieldCheck className="inline w-4 h-4 mr-1" /> : <FileText className="inline w-4 h-4 mr-1" />}
            {callout}
          </div>

          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h4 className="font-extrabold text-slate-900 text-sm sm:text-base border-b pb-1">
                {section.title}
              </h4>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              {section.bullets && (
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="p-4 bg-slate-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <a
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <span>
              {isFr
                ? isPrivacy ? 'Consulter la politique de Restos CRM' : "Consulter les conditions de Restos CRM"
                : isPrivacy ? 'View Restos CRM privacy notice' : 'View Restos CRM terms'}
            </span>
            <ExternalLink size={12} />
          </a>

          <button
            type="button"
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
