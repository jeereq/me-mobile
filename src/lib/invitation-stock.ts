/**
 * Garde le jeton d'une invitation d'équipe jusqu'à ce qu'elle soit acceptée, refusée ou périmée.
 * Avant, le jeton ne vivait que dans la mémoire de la page, et l'adresse était nettoyée dès l'ouverture : une personne qui devait
 * créer un compte, confirmer son email ou se reconnecter (ce qui recharge la page) perdait son invitation, qui restait « en attente ».
 * Module pur : le stockage (localStorage) est passé en paramètre, ce qui le rend testable.
 */

export type Stockage = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void };

const CLE = 'me:invitation';
/** Une invitation vaut 7 jours côté serveur : inutile de garder un jeton plus longtemps. */
const DUREE_MS = 8 * 24 * 60 * 60 * 1000;

export function garderInvitation(st: Stockage | null, jeton: string, maintenant = Date.now()) {
  try {
    st?.setItem(CLE, JSON.stringify({ jeton, le: maintenant }));
  } catch {
    // Stockage refusé (navigation privée…) : le jeton reste au moins en mémoire pour cette session de page.
  }
}

/** Le jeton gardé, ou null s'il n'y en a pas, s'il est illisible ou s'il est trop ancien (il est alors effacé). */
export function invitationGardee(st: Stockage | null, maintenant = Date.now()): string | null {
  try {
    const brut = st?.getItem(CLE);
    if (!brut) return null;
    const v = JSON.parse(brut) as { jeton?: unknown; le?: unknown };
    if (typeof v.jeton === 'string' && v.jeton && typeof v.le === 'number' && maintenant - v.le < DUREE_MS) return v.jeton;
    st?.removeItem(CLE);
  } catch {
    try {
      st?.removeItem(CLE);
    } catch {
      // rien à faire
    }
  }
  return null;
}

export function oublierInvitation(st: Stockage | null) {
  try {
    st?.removeItem(CLE);
  } catch {
    // rien à faire
  }
}
