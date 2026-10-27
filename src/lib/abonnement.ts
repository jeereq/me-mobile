/**
 * Abonnements (voir me-api, src/services/abonnements/offres.ts) : essai Pro de 14 jours, offre gratuite, Pro prépayé.
 * Module pur, testé dans tests/abonnement.test.ts.
 */

export type Periode = 'mensuel' | 'annuel';
export type FonctionPro = 'assistant' | 'integrations' | 'equipes' | 'emails' | 'push';

export type EtatAbonnement = {
  actif: boolean;
  offre: 'gratuit' | 'essai' | 'pro' | 'libre';
  pro: boolean;
  periode: Periode | null;
  jusqua: string | null;
  joursRestants: number | null;
  fonctions: FonctionPro[];
};

export type Offres = {
  actif: boolean;
  /** Le paiement FlexPaie est configuré sur le serveur. */
  paiement: boolean;
  versionCgv: string;
  devise: string;
  essaiJours: number;
  pro: { nom: string; mensuel: { prix: number; libelle: string }; annuel: { prix: number; libelle: string; economie?: string } };
  fonctions: Record<FonctionPro, string>;
};

export type Paiement = { reference: string; periode: Periode; montant: number; devise: string; statut: 'en_attente' | 'paye' | 'echoue'; message: string | null; payeLe: string | null; createdAt: string };

/** Pas d'état (mode local, ou serveur plus ancien) : tout est ouvert. */
export const estPro = (e: EtatAbonnement | null | undefined) => !e || e.pro;

/**
 * Tarifs affichés avant connexion (sans serveur à interroger). À garder identiques à
 * me-api/src/services/abonnements/offres.ts et à public/cgv.html.
 */
export const TARIFS = {
  devise: 'USD',
  essaiJours: 14,
  mensuel: 499,
  annuel: 4999,
  /** Ce que Pro ajoute à Gratuit, dans l'ordre de l'écran Abonnement. */
  pro: ['Le copilote IA : questions, plan du jour, brouillons de relance', 'Gmail, Outlook, Google Agenda, To Do, Trello et Slack connectés', 'Les équipes et leurs espaces partagés', 'Les rappels par email et en notification push'],
} as const;

/** Ce que l'offre gratuite garde, pour l'écran des offres. */
export const INCLUS_GRATUIT = ['Tâches, relances, habitudes et projets', 'Finances, budgets, statistiques et récompenses', 'Rappels dans l’app', 'Rejoindre une équipe sur invitation'];

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dans = (j: number | null) => (j === null ? '' : j <= 0 ? "aujourd'hui" : j === 1 ? 'demain' : `dans ${j} jours`);

/** Une ligne qui résume l'abonnement, pour Mon compte et le menu Plus. */
export function resumeAbonnement(e: EtatAbonnement | null | undefined): string {
  if (!e || e.offre === 'libre') return 'Toutes les fonctions sont incluses.';
  if (e.offre === 'essai') return `Essai Pro : se termine ${dans(e.joursRestants)}${e.jusqua ? ` (${date(e.jusqua)})` : ''}.`;
  if (e.offre === 'pro') return `Pro ${e.periode === 'annuel' ? 'annuel' : 'mensuel'} jusqu'au ${date(e.jusqua!)}, sans renouvellement automatique.`;
  return 'Offre gratuite. Pro débloque le copilote IA, les comptes connectés, les équipes et les rappels par email et push.';
}

/** Petit badge du menu : PRO, ESSAI · 5 J, GRATUIT ; rien quand les abonnements sont coupés. */
export function badgeAbonnement(e: EtatAbonnement | null | undefined): string | undefined {
  if (!e || e.offre === 'libre') return undefined;
  if (e.offre === 'essai') return `ESSAI · ${e.joursRestants ?? 0} J`;
  if (e.offre === 'pro') return e.joursRestants !== null && e.joursRestants <= 7 ? `PRO · ${e.joursRestants} J` : 'PRO';
  return 'GRATUIT';
}

const SYMBOLES: Record<string, string> = { USD: '$', EUR: '€', CDF: 'FC' };

/** Montant en centimes → « 4,99 $ », comme dans les conditions de vente. */
export const fmtPrix = (centimes: number, devise: string) => `${(centimes / 100).toFixed(2).replace('.', ',')} ${SYMBOLES[devise] ?? devise}`;
