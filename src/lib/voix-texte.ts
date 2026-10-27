/**
 * Outils de langue pour la commande vocale : nombres dits en lettres, formules de politesse, mots qui comptent.
 * La dictée écrit souvent « douze euros cinquante » ou « deux cents » en toutes lettres : on les remet en chiffres.
 */

export const sansAccents = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const liste = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}` : l[0] ?? '');
export const n = (k: number, un: string, plusieurs: string) => `${k} ${k > 1 ? plusieurs : un}`;
export const majuscule = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** Mots qui comptent pour reconnaître une tâche, un budget ou un compte : sans accents, sans les petits mots, coupés à 5 lettres (« envoyé » ≈ « envoyer »). */
const VIDES = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'l', 'a', 'au', 'aux', 'pour', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'et', 'en', 'avec', 'sur', 'j', 'ai', 'je', 'comme', 'fait', 'faite', 'fini', 'finie', 'compte', 'budget', 'objectif', 'poste', 'tache', 'relance', 'habitude']);
export const racines = (s: string) =>
  sansAccents(s)
    .split(/[^a-z0-9]+/)
    .filter((m) => m && !VIDES.has(m))
    .map((m) => m.slice(0, 5));

/** Part des mots cherchés présents dans `nom` (0 à 1) ; à égalité, le nom le plus court l'emporte. */
export function ressemblance(cherche: string, nom: string) {
  const a = racines(cherche);
  const b = new Set(racines(nom));
  if (!a.length || !b.size) return 0;
  const trouves = a.filter((m) => b.has(m)).length;
  return trouves / a.length + trouves / b.size / 100;
}

/** L'élément dont le nom ressemble le plus à `cherche` (au moins la moitié de ses mots), ou null. */
export function meilleur<T>(elements: T[], nom: (x: T) => string, cherche: string, seuil = 0.5): T | null {
  const m = elements.map((x) => ({ x, s: ressemblance(cherche, nom(x)) })).sort((a, b) => b.s - a.s)[0];
  return m && m.s >= seuil ? m.x : null;
}

/** Un nom présent tel quel dans la phrase (« courses » dans « combien pour les courses »), le plus long d'abord. */
export function nomDansPhrase<T>(elements: T[], nom: (x: T) => string, phrase: string): T | null {
  const q = ` ${sansAccents(phrase).replace(/[^a-z0-9]+/g, ' ')} `;
  return (
    [...elements]
      .filter((x) => nom(x).trim())
      .sort((a, b) => nom(b).length - nom(a).length)
      .find((x) => q.includes(` ${sansAccents(nom(x)).replace(/[^a-z0-9]+/g, ' ').trim()} `)) ?? null
  );
}

const UNITES: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, cents: 100, mille: 1000, million: 1e6, millions: 1e6,
};
const MOT_NOMBRE = new RegExp(`^(?:${Object.keys(UNITES).join('|')})$`);

/** La valeur d'une suite de mots-nombres (« quatre vingt dix sept » → 97, « deux mille cinq cents » → 2500). */
function valeur(mots: string[]): number {
  let total = 0;
  let courant = 0;
  mots.forEach((m, i) => {
    const v = UNITES[m];
    if (v === 1e6) {
      total += (courant || 1) * 1e6;
      courant = 0;
    } else if (v === 1000) {
      total += (courant || 1) * 1000;
      courant = 0;
    } else if (v === 100) courant = (courant || 1) * 100;
    // « quatre vingt » : quatre fois vingt.
    else if (v === 20 && mots[i - 1] === 'quatre' && courant % 100 === 4) courant += 76;
    // « soixante dix », « quatre vingt dix sept » : dix s'ajoute, puis l'unité.
    else courant += v;
  });
  return total + courant;
}

/**
 * Remplace les nombres dits en lettres par des chiffres : « douze euros cinquante » → « 12,50 euros »,
 * « vingt et un » → « 21 », « deux virgule cinq » → « 2,5 ». « un », « une » et « neuf » seuls restent des mots.
 */
export function nombresEnChiffres(texte: string): string {
  const morceaux = texte.split(/(\s+|-)/);
  const sortie: string[] = [];
  let suite: { brut: string[]; mots: string[] } = { brut: [], mots: [] };
  const vider = () => {
    // Les séparateurs en fin de suite (« vingt » puis espace) ne font pas partie du nombre.
    let fin: string[] = [];
    while (suite.brut.length && /^(\s+|-|et)$/i.test(suite.brut[suite.brut.length - 1])) fin = [suite.brut.pop()!, ...fin];
    const seul = suite.mots.length === 1 && /^(un|une|neuf)$/.test(suite.mots[0]);
    if (suite.mots.length && !seul) sortie.push(String(valeur(suite.mots)));
    else sortie.push(...suite.brut);
    sortie.push(...fin);
    suite = { brut: [], mots: [] };
  };
  for (const m of morceaux) {
    const s = sansAccents(m);
    if (MOT_NOMBRE.test(s)) {
      suite.brut.push(m);
      suite.mots.push(s);
    } else if (suite.mots.length && (/^(\s+|-)$/.test(m) || (s === 'et' && !suite.brut.some((x) => sansAccents(x) === 'et')))) suite.brut.push(m);
    else {
      if (suite.brut.length) vider();
      sortie.push(m);
    }
  }
  if (suite.brut.length) vider();
  return (
    sortie
      .join('')
      // « 2 virgule 5 » → « 2,5 ».
      .replace(/(\d+)\s+virgule\s+(\d+)/gi, '$1,$2')
      // « 12 euros 50 » → « 12,50 euros » (les centimes dits après la devise).
      .replace(/(\d+)\s+(euros?|dollars?|francs?)\s+(\d{1,2})(?![\d,]|\s*(?:euros?|dollars?|francs?|€|\$|fois|jours?|semaines?|mois|ans?|h\b|heures?))/gi, (_, e, dev, c) => `${e},${c.padStart(2, '0')} ${dev}`)
  );
}

/**
 * Retire ce qui entoure la demande sans la changer : « Hey Me », « Dis », « S'il te plaît », « Est-ce que tu peux »,
 * « Je voudrais », « J'aimerais »… Les apostrophes courbes deviennent droites.
 */
export function nettoyerDemande(texte: string): string {
  let t = texte
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[’`]/g, "'")
    .replace(/^(?:h[ée]y|ok|ok[ée]|dis|bon|alors|euh|salut|bonjour)(?:\s+me\b)?(?=[ ,])[ ,]*/i, '')
    .replace(/^me\s*,\s*/i, '')
    .replace(/[ ,]*(?:s'il te pla[iî]t|s'il vous pla[iî]t|stp|svp|merci(?: beaucoup)?)[ .!]*$/i, '')
    .replace(/[.!]+$/, '')
    .trim();
  // « Est-ce que tu peux ajouter… », « Je voudrais que tu notes… », « Tu pourrais… » : la demande commence au verbe.
  t = t.replace(/^(?:(?:est[- ]ce que )?tu (?:peux|pourrais|veux bien)|peux[- ]tu|pourrais[- ]tu|veux[- ]tu|je (?:veux|voudrais|souhaite|souhaiterais) que tu|j'aimerais que tu|il faudrait que tu|merci de|n'oublie pas de|pense [àa])\s+/i, '');
  // « Je voudrais ajouter… » → « Ajouter… » ; « je voudrais savoir combien… » → « combien… ».
  t = t.replace(/^(?:je (?:veux|voudrais|souhaite|souhaiterais)|j'aimerais|j'ai besoin de|j'ai envie de)\s+(?:savoir\s+|conna[iî]tre\s+)?/i, '');
  return majuscule(t.trim());
}
