import { estIncertain } from './etats-tache';
import type { Plan } from './planning';
import type { EtatTache, Priorite, Projet, Tache } from './types';

/**
 * La feuille de route : tous les projets côte à côte, une colonne par trimestre.
 * Une tâche se range dans le trimestre où elle doit finir ; les résumés (tâches qui ont des sous-tâches) ne comptent pas.
 */

/** « 2026-T4 » : se trie comme du texte. */
export const trimestreDe = (date: string) => `${date.slice(0, 4)}-T${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;
export const nomTrimestre = (cle: string) => `T${cle.slice(6)} ${cle.slice(0, 4)}`;
export function trimestreSuivant(cle: string): string {
  const a = Number(cle.slice(0, 4));
  const t = Number(cle.slice(6));
  return t === 4 ? `${a + 1}-T1` : `${a}-T${t + 1}`;
}

/** Au plus trois ans affichés : le reste se range dans « Plus tard ». */
export const TRIMESTRES_MAX = 12;
export const PLUS_TARD = 'plus-tard';

export type TacheRoute = { id: string; projet: string; titre: string; fin: string; fait: boolean; retard: boolean; priorite: Priorite; responsable?: string; budget?: number; etat?: EtatTache };
export type CaseRoute = { total: number; faites: number; enRetard: number; hautes: number; /** Tâches à faire pas encore confirmées (proposées, à valider, en pipeline). */ incertaines: number; /** Budget prévu des tâches de la case. */ prevu: number; taches: TacheRoute[] };
export type ColonneRoute = {
  cle: string;
  nom: string;
  courant: boolean;
  passe: boolean;
  total: number;
  /** Ce qui reste à faire dans le trimestre, tous projets confondus. */
  restantes: number;
  /** Budget prévu des tâches du trimestre, tous projets confondus. */
  prevu: number;
  enRetard: number;
  /** Nettement plus chargé que les autres trimestres. */
  charge: boolean;
};
export type LigneRoute = { projet: Projet; cases: Record<string, CaseRoute>; total: number; faites: number };
export type FeuilleDeRoute = { colonnes: ColonneRoute[]; lignes: LigneRoute[]; /** Le plus de tâches restantes dans un trimestre : l'échelle des barres. */ max: number };

const caseVide = (): CaseRoute => ({ total: 0, faites: 0, enRetard: 0, hautes: 0, incertaines: 0, prevu: 0, taches: [] });

export function feuilleDeRoute(entrees: { projet: Projet; plan: Plan; taches: Tache[] }[], aujourdhui: string): FeuilleDeRoute {
  const courant = trimestreDe(aujourdhui);
  const toutes: TacheRoute[] = [];
  for (const { projet, plan, taches } of entrees)
    for (const t of taches) {
      const l = plan.lignes.get(t.id);
      if (!l || l.resume) continue;
      toutes.push({ id: t.id, projet: projet.id, titre: t.titre, fin: l.fin, fait: l.fait, retard: !l.fait && l.fin < aujourdhui, priorite: t.priorite, ...(t.responsable ? { responsable: t.responsable } : {}), ...(t.budget ? { budget: t.budget } : {}), ...(t.etat && !l.fait ? { etat: t.etat } : {}) });
    }
  if (!toutes.length) return { colonnes: [], lignes: entrees.map(({ projet }) => ({ projet, cases: {}, total: 0, faites: 0 })), max: 0 };

  // La première colonne : le plus ancien trimestre où il reste du travail, au plus tard le trimestre en cours.
  const restantes = toutes.filter((t) => !t.fait).map((t) => trimestreDe(t.fin));
  const premier = [courant, ...restantes].sort()[0];
  const dernierVoulu = [courant, ...toutes.map((t) => trimestreDe(t.fin))].sort().pop()!;
  const cles: string[] = [];
  for (let c = premier; c <= dernierVoulu && cles.length < TRIMESTRES_MAX; c = trimestreSuivant(c)) cles.push(c);
  const dernier = cles[cles.length - 1];
  const deborde = toutes.some((t) => trimestreDe(t.fin) > dernier);
  // Ce qui est fini avant la première colonne n'apparaît pas : la feuille de route regarde devant.
  const colonneDe = (t: TacheRoute) => {
    const c = trimestreDe(t.fin);
    return c < premier ? null : c > dernier ? PLUS_TARD : c;
  };

  const lignes: LigneRoute[] = entrees.map(({ projet }) => ({ projet, cases: {}, total: 0, faites: 0 }));
  const parProjet = new Map(lignes.map((l) => [l.projet.id, l]));
  for (const t of toutes) {
    const ligne = parProjet.get(t.projet)!;
    ligne.total++;
    if (t.fait) ligne.faites++;
    const cle = colonneDe(t);
    if (!cle) continue;
    const k = (ligne.cases[cle] ??= caseVide());
    k.total++;
    if (t.fait) k.faites++;
    else if (t.priorite === 'haute') k.hautes++;
    if (t.retard) k.enRetard++;
    k.prevu += t.budget ?? 0;
    if (!t.fait && estIncertain(t.etat)) k.incertaines++;
    k.taches.push(t);
  }
  const rang: Record<Priorite, number> = { haute: 0, moyenne: 1, basse: 2 };
  for (const l of lignes) for (const k of Object.values(l.cases)) k.taches.sort((a, b) => Number(a.fait) - Number(b.fait) || rang[a.priorite] - rang[b.priorite] || a.fin.localeCompare(b.fin));

  const somme = (cle: string, f: (k: CaseRoute) => number) => lignes.reduce((n, l) => n + (l.cases[cle] ? f(l.cases[cle]) : 0), 0);
  const colonnes: ColonneRoute[] = [...cles, ...(deborde ? [PLUS_TARD] : [])].map((cle) => ({
    cle,
    nom: cle === PLUS_TARD ? 'Plus tard' : nomTrimestre(cle),
    courant: cle === courant,
    passe: cle !== PLUS_TARD && cle < courant,
    total: somme(cle, (k) => k.total),
    restantes: somme(cle, (k) => k.total - k.faites),
    prevu: somme(cle, (k) => k.prevu),
    enRetard: somme(cle, (k) => k.enRetard),
    charge: false,
  }));
  // « Chargé » : au moins moitié plus que la moyenne des trimestres où il reste du travail (et pas pour trois tâches).
  const actives = colonnes.filter((c) => c.cle !== PLUS_TARD && c.restantes > 0);
  const moyenne = actives.length ? actives.reduce((n, c) => n + c.restantes, 0) / actives.length : 0;
  for (const c of actives) c.charge = actives.length > 1 && c.restantes >= 5 && c.restantes >= moyenne * 1.5;
  return { colonnes, lignes, max: Math.max(0, ...colonnes.map((c) => c.restantes)) };
}

/** Les tâches d'une colonne (tous projets), ou d'une seule case. */
export function tachesDe(f: FeuilleDeRoute, cle: string, projet?: string | null): TacheRoute[] {
  return f.lignes.filter((l) => !projet || l.projet.id === projet).flatMap((l) => l.cases[cle]?.taches ?? []);
}
