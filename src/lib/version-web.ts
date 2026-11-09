/**
 * Après une mise en ligne, un onglet resté ouvert sur l'ancienne version cherche des morceaux de l'app qui n'existent plus
 * (« Loading module …/taches-….js failed »). Module pur, testé dans tests/version-web.test.ts.
 */
export const estFichierPerime = (message: string) => /Loading module .*(_expo\/static|\.js).* failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk .* failed/i.test(message);

/** La même clé que public/avant-app.js : un seul rechargement à la suite, jamais une boucle. */
const CLE = 'me-rechargement';

/** Recharge une fois pour prendre la nouvelle version. Faux si on vient déjà de recharger (ou hors navigateur). */
export function rechargerUneFois(): boolean {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return false;
  try {
    if (sessionStorage.getItem(CLE)) return false;
    sessionStorage.setItem(CLE, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
