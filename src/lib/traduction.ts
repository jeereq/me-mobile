/** Traduire des textes par petits paquets, sans demander deux fois la même chose. Module pur : la demande au serveur est passée en paramètre. */
export type Langue = 'fr' | 'en' | 'pt';
export const LANGUES: { cle: Langue; label: string; voix: string }[] = [
  { cle: 'fr', label: 'Français', voix: 'fr-FR' },
  { cle: 'en', label: 'English', voix: 'en-US' },
  { cle: 'pt', label: 'Português', voix: 'pt-PT' },
];
export const voixDe = (l: Langue) => LANGUES.find((x) => x.cle === l)!.voix;

export const MAX_PAQUET = 14_000;
const MAX_ENTREES = 60;

/** Un long texte en morceaux, aux fins de paragraphe, sinon de phrase, sinon de mot. */
export function couperTexte(texte: string, max = MAX_PAQUET): string[] {
  if (texte.length <= max) return [texte];
  const out: string[] = [];
  let reste = texte;
  while (reste.length > max) {
    const fenetre = reste.slice(0, max);
    const para = fenetre.lastIndexOf('\n\n');
    const phrase = Math.max(fenetre.lastIndexOf('. '), fenetre.lastIndexOf('\n'));
    const mot = fenetre.lastIndexOf(' ');
    const n = para > max / 2 ? para : phrase > max / 2 ? phrase + 1 : mot > 0 ? mot : max;
    out.push(reste.slice(0, n).trim());
    reste = reste.slice(n).trim();
  }
  if (reste) out.push(reste);
  return out;
}

/** Des morceaux en paquets que le serveur accepte. */
export function paquetsTexte(morceaux: string[], max = MAX_PAQUET): string[][] {
  const out: string[][] = [];
  let courant: string[] = [];
  let taille = 0;
  for (const m of morceaux) {
    if (courant.length && (taille + m.length > max || courant.length >= MAX_ENTREES)) {
      out.push(courant);
      courant = [];
      taille = 0;
    }
    courant.push(m);
    taille += m.length;
  }
  if (courant.length) out.push(courant);
  return out;
}

const cache = new Map<string, string>();
export const oublierTraductions = () => cache.clear();

/** Traduit des textes, dans le même ordre : un texte vide reste vide, un texte déjà traduit revient sans demande. */
export async function traduire(textes: string[], langue: Langue, demander: (lot: string[], langue: Langue) => Promise<string[]>): Promise<string[]> {
  const cle = (t: string) => `${langue}:${t}`;
  const decoupes = textes.map((t) => (t.trim() ? couperTexte(t) : []));
  const manquants = [...new Set(decoupes.flat())].filter((m) => !cache.has(cle(m)));
  for (const lot of paquetsTexte(manquants)) {
    const r = await demander(lot, langue);
    lot.forEach((m, i) => cache.set(cle(m), r[i] ?? m));
  }
  return decoupes.map((d, i) => (d.length ? d.map((m) => cache.get(cle(m)) ?? m).join('\n\n') : textes[i]));
}
