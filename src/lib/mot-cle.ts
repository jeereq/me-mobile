/**
 * Mot-clé vocal : l'app écoute (au premier plan, si on l'a demandé) et ouvre la commande vocale quand elle entend le mot.
 * Tout ce qui suit le mot dans la même phrase (« Hey Me, ajoute une dépense de 12 euros ») est exécuté tout de suite.
 * Ce fichier ne contient que la reconnaissance du mot dans un texte : l'écoute elle-même est dans `ecoute.ts`.
 */

export type MotCle = { actif: boolean; mot: string };
export const MOT_PAR_DEFAUT = 'Hey Me';
export const MOTS_PROPOSES = ['Hey Me', 'Salut Me', 'Ok Me'];
export const MOT_CLE_DEFAUT: MotCle = { actif: false, mot: MOT_PAR_DEFAUT };

/** Minuscules, sans accents ni ponctuation, mots séparés par une espace. */
export function normaliser(t: string) {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Ce que le message dit à celui qui choisit un mot trop court ou trop long ; null s'il convient. */
export function erreurMot(mot: string): string | null {
  const n = normaliser(mot);
  if (n.length < 4) return 'Choisis un mot ou une expression d’au moins 4 lettres : un mot trop court se confond avec ce que tu dis.';
  if (n.length > 30 || n.split(' ').length > 3) return 'Trois mots au plus, pour que le micro le reconnaisse bien.';
  return null;
}

// Façons dont la dictée écrit ce qu'elle entend : « Hey Me » devient volontiers « hé mi » ou « ey me ».
const SYNONYMES: Record<string, string[]> = {
  hey: ['hey', 'he', 'ey', 'hay', 'hei', 'hé'],
  ok: ['ok', 'okay', 'oke'],
  salut: ['salut', 'salu'],
  me: ['me', 'mi', 'mie', 'mee'],
};
const normaliserMot = (m: string) => normaliser(m);

/** Toutes les écritures acceptées pour un mot-clé, chacune découpée en mots normalisés. */
export function variantes(mot: string): string[][] {
  const mots = normaliser(mot).split(' ').filter(Boolean);
  if (!mots.length) return [];
  let l: string[][] = [[]];
  for (const m of mots) {
    const choix = [...new Set((SYNONYMES[m] ?? [m]).map(normaliserMot))];
    l = l.flatMap((p) => choix.map((c) => [...p, c]));
  }
  return l;
}

/**
 * Le mot-clé est-il dans ce que le micro a entendu ? `suite` est ce qui vient après (avec son orthographe d'origine), vide si
 * la phrase s'arrête au mot. Le mot doit être entier : « hey me » ne se trouve pas dans « they measure ».
 */
export function detecter(texte: string, mot: string): { trouve: boolean; suite: string } {
  const v = variantes(mot);
  if (!v.length) return { trouve: false, suite: '' };
  const jetons = [...texte.matchAll(/\S+/g)].map((m) => ({ n: normaliser(m[0]), fin: (m.index ?? 0) + m[0].length }));
  // Un jeton comme « hey, » devient « hey » ; un jeton qui n'est que de la ponctuation s'efface.
  const propres = jetons.filter((j) => j.n);
  for (let i = 0; i < propres.length; i++) {
    for (const p of v) {
      if (p.every((w, k) => propres[i + k]?.n === w)) {
        const fin = propres[i + p.length - 1].fin;
        return { trouve: true, suite: texte.slice(fin).replace(/^[\s,.;:!?…-]+/, '').trim() };
      }
    }
  }
  return { trouve: false, suite: '' };
}

/** Relit un réglage enregistré, en ignorant ce qui n'a pas la bonne forme. */
export function lireMotCle(brut: unknown): MotCle {
  const x = (brut && typeof brut === 'object' ? brut : {}) as Partial<MotCle>;
  const mot = typeof x.mot === 'string' && !erreurMot(x.mot) ? x.mot.trim() : MOT_PAR_DEFAUT;
  return { actif: x.actif === true, mot };
}
