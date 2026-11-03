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

/**
 * Lit des morceaux l'un après l'autre, avec une pause valable partout : la synthèse d'Android ne sait pas se mettre en pause,
 * alors on coupe, et la reprise repart au début du morceau en cours.
 * `tour` écarte les retours en retard : couper une lecture déclenche selon les plateformes une fin ou une erreur, qui ne doit pas la faire avancer.
 */
export function lecteur(morceaux: string[], dire: (texte: string, fin: () => void) => void, finir: () => void) {
  let i = 0;
  let tour = 0;
  let enPause = false;
  let termine = false;
  const suite = () => {
    if (enPause || termine) return;
    if (i >= morceaux.length) {
      termine = true;
      return finir();
    }
    const t = ++tour;
    dire(morceaux[i], () => {
      if (t !== tour) return;
      i++;
      suite();
    });
  };
  return {
    lancer: suite,
    pause: () => {
      enPause = true;
      tour++;
    },
    reprendre: () => {
      enPause = false;
      suite();
    },
    annuler: () => {
      termine = true;
      tour++;
    },
  };
}
