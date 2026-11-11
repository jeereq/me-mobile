import type { Plan } from './planning';
import type { Projet, Tache } from './types';

/** Les piliers du groupe, numérotés : chaque action dit à quel(s) pilier(s) elle contribue. Dix au départ, que l'on peut renommer, retirer ou compléter (voir `Espace.piliers`). */
export const PILIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const MAX_PILIERS = 20;
/** Un pilier choisi par l'utilisateur : `id` sert à la synchronisation, `n` est le numéro que portent les tâches. */
export type Pilier = { id: string; n: number; nom: string };

/** Le nom d'un pilier : celui qu'on lui a donné, sinon « Pilier 3 ». */
export const nomPilier = (n: number, piliers?: Pilier[]) => piliers?.find((p) => p.n === n)?.nom.trim() || `Pilier ${n}`;
/** Un nom qui reste celui d'origine (« Pilier 3 ») : les puces n'affichent alors que le numéro. */
export const nomParDefaut = (p: Pilier) => !p.nom.trim() || p.nom.trim() === `Pilier ${p.n}`;

export const piliersParDefaut = (): Pilier[] => PILIERS.map((n) => ({ id: `p${n}`, n, nom: `Pilier ${n}` }));
/** Les piliers de l'espace, dans l'ordre des numéros ; tant que rien n'est choisi, les dix d'origine. */
export const piliersDe = (e: { piliers?: Pilier[] }): Pilier[] => (e.piliers ? [...e.piliers].sort((a, b) => a.n - b.n) : piliersParDefaut());

export const renommerPilier = (piliers: Pilier[], n: number, nom: string): Pilier[] => piliers.map((p) => (p.n === n ? { ...p, nom } : p));
/** Ajoute le pilier suivant (le plus grand numéro + 1) ; la liste ne change pas au-delà de `MAX_PILIERS`. */
export function ajouterPilier(piliers: Pilier[]): Pilier[] {
  const n = piliers.reduce((m, p) => Math.max(m, p.n), 0) + 1;
  return piliers.length >= MAX_PILIERS ? piliers : [...piliers, { id: `p${n}`, n, nom: `Pilier ${n}` }];
}
/** Combien de tâches portent ce pilier. */
export const nbTachesDuPilier = (taches: Pick<Tache, 'pilier'>[], n: number) => taches.filter((t) => t.pilier?.includes(n)).length;
/** Retire un pilier de la liste et de toutes les tâches qui le portent. */
export function retirerPilier<E extends { piliers?: Pilier[]; taches: Tache[] }>(e: E, n: number): E {
  return {
    ...e,
    piliers: piliersDe(e).filter((p) => p.n !== n),
    taches: e.taches.map((t) => {
      if (!t.pilier?.includes(n)) return t;
      const { pilier, ...reste } = t;
      const garde = pilier.filter((x) => x !== n);
      return garde.length ? { ...reste, pilier: garde } : reste;
    }),
  };
}

type Entree = { projet: Projet; plan: Plan; taches: Tache[] };

/** Les piliers que des actions citent, dans l'ordre. */
export const piliersUtilises = (entrees: Entree[]): number[] => [...new Set(entrees.flatMap((e) => e.taches.flatMap((t) => t.pilier ?? [])))].sort((a, b) => a - b);

/** Ne garde que les actions d'un pilier (null : tout). Le plan reste celui du projet entier : les dates ne changent pas. */
export const filtrerPilier = (entrees: Entree[], pilier: number | null): Entree[] => (pilier === null ? entrees : entrees.map((e) => ({ ...e, taches: e.taches.filter((t) => t.pilier?.includes(pilier)) })));

export type LignePilier = { pilier: number; /** Son nom, quand l'utilisateur en a choisi un. */ nom?: string; total: number; faites: number; enRetard: number };
/** Pour un lot d'actions finissant dans le trimestre : où en est chaque pilier. Une action de deux piliers compte pour les deux. */
export function parPilier(taches: { pilier?: number[]; fait: boolean; retard: boolean }[], piliers?: Pilier[]): LignePilier[] {
  const m = new Map<number, LignePilier>();
  for (const t of taches)
    for (const n of t.pilier ?? []) {
      const l = m.get(n) ?? { pilier: n, ...(piliers ? { nom: nomPilier(n, piliers) } : {}), total: 0, faites: 0, enRetard: 0 };
      l.total++;
      if (t.fait) l.faites++;
      if (t.retard) l.enRetard++;
      m.set(n, l);
    }
  return [...m.values()].sort((a, b) => a.pilier - b.pilier);
}
