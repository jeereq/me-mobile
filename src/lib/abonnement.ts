/**
 * Abonnements (voir me-api, src/services/abonnements/offres.ts) : essai de 14 jours, puis trois formules prépayées :
 * Gratuit, Finances (finances avancées) et Pro (tout Finances, plus le copilote IA, les comptes connectés, les équipes,
 * les rappels par email et push). Pro a quatre paliers : Pro 0 (sans réunions), puis Pro 1, 2 et 3 qui ajoutent l'enregistrement
 * des réunions (3, 10 ou 25 h par mois) ; leur prix s'ajoute à celui de Pro. Module pur, testé dans tests/abonnement.test.ts.
 */

export type Periode = 'mensuel' | 'annuel';
export type Formule = 'finances' | 'pro';
export type FonctionPro = 'assistant' | 'integrations' | 'equipes' | 'emails' | 'push' | 'sms';
export type FonctionFinances = 'justificatifs' | 'releves' | 'comptes' | 'prets' | 'echeances' | 'bilan' | 'alertes';
export type FonctionReunions = 'reunions';
export type Fonction = FonctionPro | FonctionFinances | FonctionReunions;
/** Palier de réunions de Pro : 0 (sans réunions) à 3. */
export type Palier = 0 | 1 | 2 | 3;
export type PalierReunions = 1 | 2 | 3;

/** Audio de réunion transcrit sur la période en cours (mois civil, ou essai). */
export type CompteurReunions = { cle: string; limiteSecondes: number; utiliseesSecondes: number; /** null : illimité. */ restantesSecondes: number | null; illimite: boolean };

export type EtatAbonnement = {
  actif: boolean;
  offre: 'gratuit' | 'essai' | 'finances' | 'pro' | 'libre';
  pro: boolean;
  /** Absent sur un serveur plus ancien (deux offres) : les finances y étaient toutes gratuites. */
  finances?: boolean;
  periode: Periode | null;
  /** Palier de réunions de Pro. Absent sur un serveur plus ancien (Pro 0). */
  palier?: Palier;
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
  /** Paliers de réunions (Pro 1 à 3) : heures par mois et prix à ajouter à celui de Pro. Absent sur un serveur plus ancien. */
  paliers?: Record<PalierReunions, { nom: string; heures: number; mensuel: Tarif; annuel: Tarif }>;
  essaiReunionMinutes?: number;
};

export type Paiement = { reference: string; formule?: Formule; palier?: Palier; periode: Periode; montant: number; devise: string; statut: 'en_attente' | 'paye' | 'echoue' | 'expire' | 'abandonne'; message: string | null; payeLe: string | null; createdAt: string };

/** Pas d'état (mode local, ou serveur plus ancien) : tout est ouvert. */
export const estPro = (e: EtatAbonnement | null | undefined) => !e || e.pro;
/** Finances avancées ouvertes : Finances, Pro, essai, ou serveur qui ne connaît pas encore la formule Finances. */
export const estFinances = (e: EtatAbonnement | null | undefined) => !e || e.pro || e.finances !== false;

/**
 * Tarifs affichés avant connexion (sans serveur à interroger). À garder identiques à
 * me-api/src/services/abonnements/offres.ts, à public/cgv.html et aux offres de public/index.html.
 */
export const TARIFS = {
  devise: 'USD',
  essaiJours: 14,
  finances: { mensuel: 199, annuel: 1999 },
  pro: { mensuel: 499, annuel: 4999 },
  /** Prix à ajouter à celui de Pro, et heures de réunion par mois. */
  paliers: {
    1: { heures: 3, mensuel: 199, annuel: 1999 },
    2: { heures: 10, mensuel: 499, annuel: 4999 },
    3: { heures: 25, mensuel: 999, annuel: 9999 },
  },
  essaiReunionMinutes: 45,
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
export const INCLUS_PRO = ['Le copilote IA : questions, plan du jour, brouillons de relance, factures lues', 'Gmail, Outlook, Google Agenda, To Do, Trello et Slack connectés', 'Les équipes et leurs espaces partagés', 'Tous les rappels par email et en notification push'];

/** Ce que Pro 1, 2 et 3 ajoutent à Pro. */
export const INCLUS_REUNIONS = [
  'Enregistrer une réunion entière, transcrite en français',
  'Résumé, décisions, tâches, relances, habitudes et mails à relire',
  'Tâches attribuées aux membres de l’équipe, aux projets et au planning',
  'L’audio n’est jamais conservé',
];

export const NOM_FORMULE: Record<Formule, string> = { finances: 'Finances', pro: 'Pro' };

/** « Pro », « Pro 2 » ou « Finances » : le nom d'une formule avec son palier. */
export const nomOffre = (f: Formule, palier: Palier | undefined) => (f === 'pro' && palier ? `Pro ${palier}` : NOM_FORMULE[f]);

/** Les réunions sont ouvertes : palier Pro 1 à 3, essai, ou tout inclus. Faux sur un serveur qui ne les connaît pas. */
export const peutReunions = (e: EtatAbonnement | null | undefined) => !!e && e.fonctions.includes('reunions');

/** « 2 h 10 », « 45 min ». */
export function dureeHeures(secondes: number): string {
  const m = Math.max(0, Math.floor(secondes / 60));
  const h = Math.floor(m / 60);
  return h ? `${h} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`;
}

/** « Il te reste 2 h 10 ce mois-ci. » ; null quand il n'y a pas de limite à dire. */
export function resteReunions(c: CompteurReunions | null | undefined, essai = false): string | null {
  if (!c || c.illimite || c.restantesSecondes === null) return null;
  return `Il te reste ${dureeHeures(c.restantesSecondes)} de réunion ${essai ? 'dans ton essai' : 'ce mois-ci'}.`;
}

/** Prix d'une offre en centimes : celui de la formule, plus celui du palier pour Pro. Null quand le serveur ne la connaît pas. */
export function prixOffre(o: Offres | null, f: Formule, palier: Palier, p: Periode): number | null {
  const base = tarif(o, f, p);
  if (base === null || f !== 'pro' || !palier) return base;
  const pal = o ? o.paliers?.[palier]?.[p].prix : TARIFS.paliers[palier][p];
  return pal === undefined ? null : base + pal;
}

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
    return `Essai de tout Pro, dont 45 minutes de réunion : se termine ${dans(e.joursRestants)}${e.jusqua ? ` (${date(e.jusqua)})` : ''}.${suite}`;
  }
  if (e.offre === 'pro' || e.offre === 'finances')
    return `${nomOffre(e.offre, e.palier)} ${e.periode === 'annuel' ? 'annuel' : 'mensuel'} jusqu'au ${date(e.jusqua!)}, sans renouvellement automatique.`;
  return 'Offre gratuite.';
}

/** Petit badge du menu : PRO, FINANCES, ESSAI · 5 J, GRATUIT ; rien quand les abonnements sont coupés. */
export function badgeAbonnement(e: EtatAbonnement | null | undefined): string | undefined {
  if (!e || e.offre === 'libre') return undefined;
  if (e.offre === 'essai') return `ESSAI · ${e.joursRestants ?? 0} J`;
  if (e.offre === 'pro' || e.offre === 'finances') {
    const nom = e.offre === 'pro' ? (e.palier ? `PRO ${e.palier}` : 'PRO') : 'FINANCES';
    return e.joursRestants !== null && e.joursRestants <= 7 ? `${nom} · ${e.joursRestants} J` : nom;
  }
  return 'GRATUIT';
}

const SYMBOLES: Record<string, string> = { USD: '$', EUR: '€', CDF: 'FC' };

/** Montant en centimes → « 4,99 $ », comme dans les conditions de vente. */
export const fmtPrix = (centimes: number, devise: string) => `${(centimes / 100).toFixed(2).replace('.', ',')} ${SYMBOLES[devise] ?? devise}`;

/**
 * Changer de formule ou de palier pendant une période payée : le temps qui reste est converti au prorata des prix mensuels
 * (comme le serveur, `prolonger`). Renvoie les jours que vaudra ce reste dans la nouvelle offre, ou null s'il n'y a rien à convertir.
 */
export function joursConvertis(e: EtatAbonnement | null | undefined, o: Offres | null, vers: Formule, versPalier: Palier = 0): { de: string; jours: number; joursAvant: number } | null {
  if (!e || !o?.formules || (e.offre !== 'finances' && e.offre !== 'pro') || !e.joursRestants) return null;
  const palierAvant: Palier = e.offre === 'pro' ? (e.palier ?? 0) : 0;
  const palierApres: Palier = vers === 'pro' ? versPalier : 0;
  if (e.offre === vers && palierAvant === palierApres) return null;
  const avant = prixOffre(o, e.offre, palierAvant, 'mensuel');
  const apres = prixOffre(o, vers, palierApres, 'mensuel');
  if (!avant || !apres) return null;
  return { de: nomOffre(e.offre, palierAvant), jours: Math.floor((e.joursRestants * avant) / apres), joursAvant: e.joursRestants };
}
