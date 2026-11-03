/** Reconnaissance vocale : ce qui se décide sans le micro. Module pur. */

/**
 * Rassemble ce que le micro rend : en écoute continue, chaque silence clôt un segment, et le suivant repart de zéro.
 * On garde les segments finis, pour qu'une pause au milieu d'une phrase ne l'efface pas.
 */
export function assembleur() {
  let acquis = '';
  const avec = (t: string) => [acquis, t.trim()].filter(Boolean).join(' ');
  return {
    recevoir(t: string, final: boolean) {
      const tout = avec(t);
      if (final) acquis = tout;
      return tout;
    },
    /** Les autres façons de comprendre ce segment, à la suite de ce qui est déjà acquis. */
    variantes: (alternatives: string[], final: boolean) => {
      if (!final) return alternatives.map(avec);
      const avant = acquis.slice(0, Math.max(0, acquis.length - (alternatives[0]?.trim().length ?? 0))).trim();
      return alternatives.map((a) => [avant, a.trim()].filter(Boolean).join(' '));
    },
  };
}

/** Le micro hésite parfois : on garde la première façon de comprendre qui est une vraie commande, sinon ce qu'il a compris d'abord. */
export function choisirAlternative(alternatives: string[], comprise: (t: string) => boolean): string {
  const propres = alternatives.map((a) => a.trim()).filter(Boolean);
  return propres.find(comprise) ?? propres[0] ?? '';
}

/** La phrase avec ce qui vient d'être dicté à sa suite. */
export function aLaSuite(base: string, dicte: string): string {
  const b = base.replace(/\s+$/, '');
  const d = dicte.trim();
  if (!b) return d;
  if (!d) return base;
  return `${b}${/\n$/.test(base) ? '\n' : ' '}${d}`;
}
