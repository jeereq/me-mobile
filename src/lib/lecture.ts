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
export function lecteur(morceaux: string[], dire: (texte: string, fin: () => void) => void, finir: () => void, surMorceau?: (i: number) => void) {
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
    surMorceau?.(i);
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
    /** Avance ou recule de quelques morceaux, sans sortir du texte ; en pause, la lecture reste en pause. */
    aller: (delta: number) => {
      if (termine || !morceaux.length) return;
      i = Math.max(0, Math.min(morceaux.length - 1, i + delta));
      tour++;
      surMorceau?.(i);
      suite();
    },
    /** Redit le morceau en cours : après un changement de vitesse. */
    redire: () => {
      if (termine) return;
      tour++;
      suite();
    },
  };
}

const MOTS: Record<'fr-FR' | 'en-US' | 'pt-PT', Set<string>> = {
  'fr-FR': new Set('le la les des une et est dans pour que qui avec sur vous nous je pas ce cette au aux du merci bonjour votre notre mais'.split(' ')),
  'en-US': new Set('the and is are of to in for that with on you we i not this your our have will be from at thanks hello please'.split(' ')),
  'pt-PT': new Set('o os as um uma e é em para que com não você nós eu este esta do da dos das seu sua obrigado olá por favor mas'.split(' ')),
};

/** La langue d'un texte, pour le faire lire par la bonne voix : le français si rien ne se dégage. */
export function langueTexte(texte: string): 'fr-FR' | 'en-US' | 'pt-PT' {
  const mots = texte.toLowerCase().slice(0, 3000).match(/[\p{L}']+/gu) ?? [];
  const compte = (l: keyof typeof MOTS) => mots.filter((m) => MOTS[l].has(m)).length;
  const fr = compte('fr-FR');
  const en = compte('en-US');
  const pt = compte('pt-PT');
  if (en > fr && en > pt && en >= 3) return 'en-US';
  if (pt > fr && pt > en && pt >= 3) return 'pt-PT';
  return 'fr-FR';
}
