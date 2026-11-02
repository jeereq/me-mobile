/**
 * Abonnements (voir me-api, src/services/abonnements/offres.ts) : essai de 14 jours, puis trois formules prépayées :
 * Gratuit, Finances (finances avancées) et Pro (tout Finances, plus le copilote IA, les comptes connectés, les équipes,
 * les rappels par email et push). Module pur, testé dans tests/abonnement.test.ts.
 */

export type Periode = 'mensuel' | 'annuel';
export type Formule = 'finances' | 'pro';
export type FonctionPro = 'assistant' | 'integrations' | 'equipes' | 'emails' | 'push';
export type FonctionFinances = 'justificatifs' | 'releves' | 'comptes' | 'prets' | 'echeances' | 'bilan' | 'alertes';
export type Fonction = FonctionPro | FonctionFinances;

export type EtatAbonnement = {
  actif: boolean;
  offre: 'gratuit' | 'essai' | 'finances' | 'pro' | 'libre';
  pro: boolean;
  /** Absent sur un serveur plus ancien (deux offres) : les finances y étaient toutes gratuites. */
  finances?: boolean;
  periode: Periode | null;
  jusqua: string | null;
  joursRestants: number | null;
  fonctions: Fonction[];
  /** Formule payée pendant l'essai, qui prend le relais à sa fin. */
  ensuite?: { formule: Formule; jusqua: string } | null;
};

type Tarif = { prix: number; libelle: string; economie?: string };
export type OffreFormule = { nom: string; mensuel: Tarif; annuel: Tarif };

export type Offres = {
  actif: boolean;
  /** Le paiement FlexPaie est configuré sur le serveur. */
  paiement: boolean;
  versionCgv: string;
  devise: string;
  essaiJours: number;
  pro: OffreFormule;
  /** Absent sur un serveur plus ancien, qui ne vend que Pro. */
  formules?: Record<Formule, OffreFormule>;
  fonctions: Record<FonctionPro, string>;
  fonctionsFinances?: Record<FonctionFinances, string>;
};

export type Paiement = { reference: string; formule?: Formule; periode: Periode; montant: number; devise: string; statut: 'en_attente' | 'paye' | 'echoue' | 'expire' | 'abandonne'; message: string | null; payeLe: string | null; createdAt: string };

/** Pas d'état (mode local, ou serveur plus ancien) : tout est ouvert. */
export const estPro = (e: EtatAbonnement | null | undefined) => !e || e.pro;
/** Finances avancées ouvertes : Finances, Pro, essai, ou serveur qui ne connaît pas encore la formule Finances. */
export const estFinances = (e: EtatAbonnement | null | undefined) => !e || e.pro || e.finances !== false;

/**
 * Tarifs affichés avant connexion (sans serveur à interroger). À garder identiques à
 * me-api/src/services/abonnements/offres.ts et à public/cgv.html.
 */
export const TARIFS = {
  devise: 'USD',
  essaiJours: 14,
  finances: { mensuel: 199, annuel: 1999 },
  pro: { mensuel: 499, annuel: 4999 },
} as const;

/** Ce que l'offre gratuite garde. */
export const INCLUS_GRATUIT = ['Tâches, relances, habitudes et projets', 'Budgets, dépenses, revenus et objectifs', 'Statistiques, export et récompenses', 'Rappels dans l’app', 'Rejoindre une équipe sur invitation'];
/** Ce que Finances ajoute à Gratuit, dans l'ordre de l'écran Abonnement. */
export const INCLUS_FINANCES = [
  'Reçus et factures joints aux dépenses',
  'Import des relevés bancaires et mobile money',
  'Plusieurs comptes et plusieurs devises',
  'Prêts et dettes entre personnes, avec rappels',
  'Paiements à venir, prévenus la veille',
  'Bilan du mois, à l’écran et par email',
  'Alertes de budget en push et par email',
];
/** Ce que Pro ajoute à Finances. */
export const INCLUS_PRO = ['Le copilote IA : questions, plan du jour, brouillons de relance', 'Gmail, Outlook, Google Agenda, To Do, Trello et Slack connectés', 'Les équipes et leurs espaces partagés', 'Tous les rappels par email et en notification push'];

export const NOM_FORMULE: Record<Formule, string> = { finances: 'Finances', pro: 'Pro' };

/**
 * Prix d'une formule pour l'écran des offres : celui du serveur s'il le donne, sinon le tarif connu.
 * Un serveur plus ancien ne connaît pas Finances : `null`, la carte n'est pas proposée au paiement.
 */
export function tarif(o: Offres | null, f: Formule, p: Periode): number | null {
  if (o?.formules) return o.formules[f][p].prix;
  if (o && f === 'pro') return o.pro[p].prix;
  if (o) return null;
  return TARIFS[f][p];
}

/** Équivalent mensuel d'un prix annuel, en centimes. */
export const parMois = (annuel: number) => Math.round(annuel / 12);

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dans = (j: number | null) => (j === null ? '' : j <= 0 ? "aujourd'hui" : j === 1 ? 'demain' : `dans ${j} jours`);

/** Une ligne qui résume l'abonnement, pour Mon compte et le menu Plus. */
export function resumeAbonnement(e: EtatAbonnement | null | undefined): string {
  if (!e || e.offre === 'libre') return 'Toutes les fonctions sont incluses.';
  if (e.offre === 'essai') {
    const suite = e.ensuite ? ` Ensuite, ${NOM_FORMULE[e.ensuite.formule]} jusqu'au ${date(e.ensuite.jusqua)}.` : '';
    return `Essai de tout Pro : se termine ${dans(e.joursRestants)}${e.jusqua ? ` (${date(e.jusqua)})` : ''}.${suite}`;
  }
  if (e.offre === 'pro' || e.offre === 'finances')
    return `${NOM_FORMULE[e.offre]} ${e.periode === 'annuel' ? 'annuel' : 'mensuel'} jusqu'au ${date(e.jusqua!)}, sans renouvellement automatique.`;
  return 'Offre gratuite. Finances ajoute les finances avancées ; Pro ajoute aussi le copilote IA, les comptes connectés, les équipes et les rappels par email et push.';
}

/** Petit badge du menu : PRO, FINANCES, ESSAI · 5 J, GRATUIT ; rien quand les abonnements sont coupés. */
export function badgeAbonnement(e: EtatAbonnement | null | undefined): string | undefined {
  if (!e || e.offre === 'libre') return undefined;
  if (e.offre === 'essai') return `ESSAI · ${e.joursRestants ?? 0} J`;
  if (e.offre === 'pro' || e.offre === 'finances') {
    const nom = e.offre === 'pro' ? 'PRO' : 'FINANCES';
    return e.joursRestants !== null && e.joursRestants <= 7 ? `${nom} · ${e.joursRestants} J` : nom;
  }
  return 'GRATUIT';
}

const SYMBOLES: Record<string, string> = { USD: '$', EUR: '€', CDF: 'FC' };

/** Montant en centimes → « 4,99 $ », comme dans les conditions de vente. */
export const fmtPrix = (centimes: number, devise: string) => `${(centimes / 100).toFixed(2).replace('.', ',')} ${SYMBOLES[devise] ?? devise}`;

/**
 * Changer de formule pendant une période payée : le temps qui reste est converti au prorata des prix mensuels (comme
 * le serveur, `prolonger`). Renvoie les jours que vaudra ce reste dans la nouvelle formule, ou null s'il n'y a rien à convertir.
 */
export function joursConvertis(e: EtatAbonnement | null | undefined, o: Offres | null, vers: Formule): { de: Formule; jours: number; joursAvant: number } | null {
  if (!e || !o?.formules || (e.offre !== 'finances' && e.offre !== 'pro') || e.offre === vers || !e.joursRestants) return null;
  const de = e.offre;
  const jours = Math.floor((e.joursRestants * o.formules[de].mensuel.prix) / o.formules[vers].mensuel.prix);
  return { de, jours, joursAvant: e.joursRestants };
}
