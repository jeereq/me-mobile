import { Platform } from 'react-native';

import { garderInvitation, invitationGardee, oublierInvitation, type Stockage } from './invitation-stock';

/**
 * Liens qui ouvrent l'app web depuis un email ou au retour de Google :
 * /verifier?jeton=…, /reinitialiser?jeton=…, /?google=code ou /?erreur_google=message.
 * Lus une fois au chargement, puis retirés de la barre d'adresse pour ne pas resservir.
 */
export type LienCompte = { type: 'verifier' | 'reinitialiser'; jeton: string } | { type: 'google'; code: string } | { type: 'erreur_google'; message: string };

function lire(): LienCompte | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const { pathname, search } = window.location;
  const q = new URLSearchParams(search);
  const page = pathname.replace(/\/+$/, '');
  let lien: LienCompte | null = null;
  if (page === '/verifier' && q.get('jeton')) lien = { type: 'verifier', jeton: q.get('jeton')! };
  else if (page === '/reinitialiser' && q.get('jeton')) lien = { type: 'reinitialiser', jeton: q.get('jeton')! };
  else if (q.get('google')) lien = { type: 'google', code: q.get('google')! };
  else if (q.get('erreur_google')) lien = { type: 'erreur_google', message: q.get('erreur_google')! };
  if (lien) nettoyerAdresse();
  return lien;
}

/** Retire le jeton ou le code de la barre d'adresse (aussi après le démarrage du routeur, qui la réécrit). */
export function nettoyerAdresse() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search) window.history.replaceState(null, '', '/');
}

/** Jeton d'une invitation à une équipe (/equipe?invitation=…) : il faut une session ouverte pour l'accepter. */
function stockage(): Stockage | null {
  try {
    return Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Le jeton vient de l'adresse, puis il est gardé sur l'appareil : créer un compte, confirmer son email ou se reconnecter recharge la page,
 * et l'invitation ne doit pas se perdre en route. Il s'oublie une fois acceptée, refusée ou périmée (`oublierInvitationGardee`).
 */
function lireInvitation(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const jeton = window.location.pathname.replace(/\/+$/, '') === '/equipe' ? q.get('invitation') : null;
  if (jeton) {
    garderInvitation(stockage(), jeton);
    nettoyerAdresse();
    return jeton;
  }
  return invitationGardee(stockage());
}

/** L'invitation n'a plus rien à attendre : acceptée, refusée, ou plus valable. */
export const oublierInvitationGardee = () => {
  enAttente = null;
  oublierInvitation(stockage());
};
let enAttente: string | null = null;
/** L'invitation à proposer maintenant, ou null : celle de l'adresse ou gardée sur l'appareil, tant qu'elle n'est pas oubliée. */
export const invitationEnAttente = () => enAttente;

export const lienInitial = lire();
export const invitationInitiale = lireInvitation();
enAttente = invitationInitiale;
