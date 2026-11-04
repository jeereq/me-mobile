/** De quoi préparer les données d'une question au copilote. Module pur. */

/** Ce que le serveur lit d'une demande : au-delà, le JSON serait coupé en plein milieu. */
export const MAX_DONNEES_QUESTION = 55_000;

/** Ce qui reste à faire d'abord, le plus proche en tête, puis les derniers terminés : une longue liste ne perd plus l'essentiel. */
export function ouvertsPuisFaits<T>(liste: T[], o: { fait: (x: T) => boolean; echeance: (x: T) => string | null | undefined; finiLe: (x: T) => string | null | undefined; maxOuverts?: number; maxFaits?: number }) {
  const ouverts = liste.filter((x) => !o.fait(x));
  const faits = liste.filter(o.fait);
  return {
    total: ouverts.length,
    ouverts: [...ouverts].sort((a, b) => (o.echeance(a) || '9999').localeCompare(o.echeance(b) || '9999')).slice(0, o.maxOuverts ?? 80),
    faits: [...faits].sort((a, b) => (o.finiLe(b) || '').localeCompare(o.finiLe(a) || '')).slice(0, o.maxFaits ?? 20),
  };
}

/** Le JSON des données, allégé dans l'ordre de `coupes` (le moins utile d'abord) tant qu'il dépasse la limite. */
export function enLimite<T>(donnees: T, coupes: ((d: T) => void)[], max = MAX_DONNEES_QUESTION): string {
  let json = JSON.stringify(donnees);
  for (const couper of coupes) {
    if (json.length <= max) break;
    couper(donnees);
    json = JSON.stringify(donnees);
  }
  return json;
}
