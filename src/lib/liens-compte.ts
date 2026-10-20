import { Platform } from 'react-native';

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

export const lienInitial = lire();
