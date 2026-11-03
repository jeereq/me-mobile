/** Découper un texte pour le lire à voix haute. Module pur, testé dans tests/comptes-rendus.test.ts. */

/**
 * Coupe un texte en morceaux courts, à la fin des phrases : les navigateurs interrompent une lecture trop longue.
 * Une phrase trop longue à elle seule est coupée entre deux mots.
 */
export function decouperLecture(texte: string, max = 220): string[] {
  const out: string[] = [];
  for (const brute of texte.split(/\n+|(?<=[.!?…])\s+/u)) {
    let reste = brute.trim();
    while (reste.length > max) {
      const coupe = reste.lastIndexOf(' ', max);
      const n = coupe > 0 ? coupe : max;
      out.push(reste.slice(0, n).trim());
      reste = reste.slice(n).trim();
    }
    if (reste) out.push(reste);
  }
  return out;
}
