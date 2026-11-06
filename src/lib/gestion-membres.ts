import type { Formule, Palier } from './abonnement';

/** L'onglet Utilisateurs de l'admin (voir me-api, services/membres/gestion.ts). Module pur, testé dans tests/gestion-membres.test.ts. */

export type FiltreMembres = 'tous' | 'abonnes' | 'essai' | 'sans' | 'expirent' | 'anciens';
export const FILTRES: { key: FiltreMembres; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'abonnes', label: 'Abonnés' },
  { key: 'essai', label: 'Essai' },
  { key: 'sans', label: 'Sans abonnement' },
  { key: 'expirent', label: 'Expirent bientôt' },
  { key: 'anciens', label: 'Anciens abonnés' },
];

export type LigneMembre = {
  id: string;
  email: string;
  nom: string;
  role: 'ADMIN' | 'COMMERCIAL' | 'UTILISATEUR';
  emailVerifie: boolean;
  creeLe: string;
  offre: 'gratuit' | 'essai' | 'finances' | 'pro' | 'libre';
  palier: Palier;
  periode: string | null;
  jusqua: string | null;
  joursRestants: number | null;
  expireLe: string | null;
};

export type Revenus = Record<string, { total: number; mois: number }>;
export type StatsMembres = Record<FiltreMembres, number> & { revenus: Revenus };
export type ReponseGestion = { membres: LigneMembre[]; total: number; page: number; parPage: number; stats: StatsMembres; abonnementsActifs: boolean };

export type PaiementFiche = { reference: string; formule: Formule; palier: number; periode: string; montant: number; devise: string; statut: string; payeLe: string | null; telephone: string; createdAt: string };
export type ActionFiche = { id: string; parNom: string; action: 'offrir' | 'essai' | 'retirer'; formule: Formule | null; palier: number; duree: string | null; finApres: string | null; note: string | null; createdAt: string };
/** Ce qu'un commercial peut recevoir. Un admin a tout. */
export const MODULES_EQUIPE = [
  { key: 'comptes', label: 'Comptes et abonnés' },
  { key: 'offres', label: 'Offrir un abonnement' },
  { key: 'verifications', label: 'Vérifier les comptes' },
  { key: 'versements', label: 'Valider les versements' },
] as const;
export type ModuleEquipe = (typeof MODULES_EQUIPE)[number]['key'];

export type FicheMembre = { modules?: ModuleEquipe[]; membre: LigneMembre; derniereActivite: string | null; paiements: PaiementFiche[]; actions: ActionFiche[] };

/** Ce qui s'offre depuis la fiche : une formule et son palier. */
export const OFFRES_ADMIN: { key: string; label: string; formule: Formule; palier: Palier }[] = [
  { key: 'finances', label: 'Finances', formule: 'finances', palier: 0 },
  { key: 'pro', label: 'Pro', formule: 'pro', palier: 0 },
  { key: 'pro1', label: 'Pro 1', formule: 'pro', palier: 1 },
  { key: 'pro2', label: 'Pro 2', formule: 'pro', palier: 2 },
  { key: 'pro3', label: 'Pro 3', formule: 'pro', palier: 3 },
];
export const DUREES_ADMIN = [1, 3, 6, 12] as const;
export const JOURS_ESSAI_ADMIN = [7, 14, 30] as const;

const nomFormule = (formule: string | null, palier: number) => (formule === 'finances' ? 'Finances' : palier ? `Pro ${palier}` : 'Pro');

export const estAbonne = (l: Pick<LigneMembre, 'offre'>) => l.offre === 'pro' || l.offre === 'finances';

/** Le nom de l'offre d'un compte : « Pro 2 », « Essai », « Gratuit », « Tout inclus » pour un admin. */
export function nomOffreMembre(l: Pick<LigneMembre, 'offre' | 'palier'>): string {
  if (l.offre === 'pro') return nomFormule('pro', l.palier);
  return { finances: 'Finances', essai: 'Essai', gratuit: 'Gratuit', libre: 'Tout inclus' }[l.offre];
}

const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** La précision sous l'offre : quand elle finit, ou quand elle a fini. */
export function detailOffre(l: LigneMembre): string {
  if (l.jusqua && l.joursRestants !== null && l.joursRestants <= 7) return l.joursRestants <= 1 ? 'Finit demain' : `Finit dans ${l.joursRestants} jours`;
  if (l.jusqua) return `Jusqu’au ${dateCourte(l.jusqua)}`;
  if (l.expireLe) return `Expiré le ${dateCourte(l.expireLe)}`;
  return '';
}

/** Une ligne du journal : « Pro 2 offert · 3 mois », « Essai prolongé · 14 jours », « Abonnement retiré ». */
export function libelleAction(a: Pick<ActionFiche, 'action' | 'formule' | 'palier' | 'duree'>): string {
  if (a.action === 'offrir') return `${nomFormule(a.formule, a.palier)} offert${a.duree ? ` · ${a.duree}` : ''}`;
  if (a.action === 'essai') return `Essai prolongé${a.duree ? ` · ${a.duree}` : ''}`;
  return 'Abonnement retiré';
}

export const STATUTS_PAIEMENT: Record<string, string> = { en_attente: 'En attente', paye: 'Payé', echoue: 'Échoué', expire: 'Expiré', abandonne: 'Abandonné' };
