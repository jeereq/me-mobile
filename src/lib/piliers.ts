import type { Plan } from './planning';
import type { Projet, Tache } from './types';

/** Les piliers du groupe, numérotés de 1 à 10 : chaque action dit à quel(s) pilier(s) elle contribue. */
export const PILIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const nomPilier = (n: number) => `Pilier ${n}`;

type Entree = { projet: Projet; plan: Plan; taches: Tache[] };

/** Les piliers que des actions citent, dans l'ordre. */
export const piliersUtilises = (entrees: Entree[]): number[] => [...new Set(entrees.flatMap((e) => e.taches.flatMap((t) => t.pilier ?? [])))].sort((a, b) => a - b);

/** Ne garde que les actions d'un pilier (null : tout). Le plan reste celui du projet entier : les dates ne changent pas. */
export const filtrerPilier = (entrees: Entree[], pilier: number | null): Entree[] => (pilier === null ? entrees : entrees.map((e) => ({ ...e, taches: e.taches.filter((t) => t.pilier?.includes(pilier)) })));

export type LignePilier = { pilier: number; total: number; faites: number; enRetard: number };
/** Pour un lot d'actions finissant dans le trimestre : où en est chaque pilier. Une action de deux piliers compte pour les deux. */
export function parPilier(taches: { pilier?: number[]; fait: boolean; retard: boolean }[]): LignePilier[] {
  const m = new Map<number, LignePilier>();
  for (const t of taches)
    for (const n of t.pilier ?? []) {
      const l = m.get(n) ?? { pilier: n, total: 0, faites: 0, enRetard: 0 };
      l.total++;
      if (t.fait) l.faites++;
      if (t.retard) l.enRetard++;
      m.set(n, l);
    }
  return [...m.values()].sort((a, b) => a.pilier - b.pilier);
}
