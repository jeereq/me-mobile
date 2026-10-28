/**
 * Les équipes : des comptes qui partagent un espace (budgets, projets, tâches, habitudes).
 *
 * L'app garde un espace par « portée » : le sien (`moi`) et celui de chaque équipe. Changer de portée change
 * l'espace affiché, la clé du cache sur l'appareil et l'adresse utilisée pour la synchro ; tout le reste
 * (révisions, conflits, fusion) est identique des deux côtés.
 */
export type RoleEquipe = 'PROPRIETAIRE' | 'MEMBRE' | 'LECTEUR';

export type MembreEquipe = { id: string; nom: string; email: string; role: RoleEquipe; depuisLe: string };
/** `envoyee` : lien jamais ouvert ; `ouverte` : ouvert avec le compte invité, pas encore accepté ; `autre_compte` : ouvert avec un compte d'une autre adresse (`ouvertePar`), donc inacceptable. */
export type EtatInvitation = 'envoyee' | 'ouverte' | 'autre_compte';
export type InvitationEquipe = { id: string; email: string; role: RoleEquipe; parNom: string; expireLe: string; etat?: EtatInvitation; ouverteLe?: string; ouvertePar?: string };
export type Equipe = { id: string; nom: string; emoji: string; creeLe: string; monRole: RoleEquipe; membres: MembreEquipe[]; invitations: InvitationEquipe[] };

/** Ce qui revient quand on invite quelqu'un : `lien` n'est là que si le serveur n'envoie pas d'emails. */
export type ResultatInvitation = { id: string; email: string; role: RoleEquipe; expireLe: string; envoye: boolean; lien?: string };

/** L'aperçu d'une invitation, avant de l'accepter. */
export type ApercuInvitation = { equipe: string; emoji: string; email: string; role: RoleEquipe; parNom: string; pourMoi: boolean };

/** Quel espace est affiché : le mien, ou celui d'une équipe. */
export type Portee = { type: 'moi' } | { type: 'equipe'; id: string };

export const PORTEE_MOI: Portee = { type: 'moi' };

export const memePortee = (a: Portee, b: Portee) => a.type === b.type && (a.type === 'moi' || a.id === (b as { id: string }).id);

/** La clé du cache sur l'appareil : l'espace d'une équipe ne se mélange pas avec le mien. */
export const clePortee = (userId: string, p: Portee) => (p.type === 'moi' ? userId : `equipe:${p.id}`);

/** L'adresse de l'espace côté serveur. */
export const cheminEspace = (p: Portee) => (p.type === 'moi' ? '/espace' : `/equipes/${p.id}/espace`);

export const NOM_ROLE: Record<RoleEquipe, string> = { PROPRIETAIRE: 'Propriétaire', MEMBRE: 'Membre', LECTEUR: 'Lecteur' };

export const AIDE_ROLE: Record<RoleEquipe, string> = {
  PROPRIETAIRE: 'Peut tout faire, y compris inviter et retirer des membres.',
  MEMBRE: 'Voit et modifie tout ce que l’équipe partage.',
  LECTEUR: 'Voit tout, ne modifie rien.',
};

/** Un lecteur regarde sans toucher ; les autres écrivent. */
export const peutEcrireEquipe = (role: RoleEquipe) => role !== 'LECTEUR';
export const peutGererEquipe = (role: RoleEquipe) => role === 'PROPRIETAIRE';

/**
 * Le serveur renvoie un lien relatif quand il ne connaît pas l'adresse du site (APP_URL absent) :
 * l'app, elle, sait où elle est servie, et complète le lien pour qu'il soit transmissible.
 */
export function lienAbsolu(lien: string) {
  if (/^https?:\/\//.test(lien)) return lien;
  const configuree = (process.env.EXPO_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  const base = configuree || (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  return base ? `${base}${lien.startsWith('/') ? '' : '/'}${lien}` : lien;
}

/** Le jeton d'invitation d'un lien `…/equipe?invitation=…`, ou null. */
export function jetonInvitation(adresse: string | null | undefined): string | null {
  if (!adresse) return null;
  try {
    const u = new URL(adresse, 'https://me.local');
    return u.searchParams.get('invitation');
  } catch {
    return null;
  }
}
