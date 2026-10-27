import { idBudgetDe } from './categories';
import { addDays, parse } from './dates';
import { bilan, bornes, budgetDuJour, plafondSur } from './finances';
import type { Finances, Horizon, Periode } from './types';

/**
 * Prévisions de dépenses : au rythme actuel, où en sera-t-on à la fin du jour, de la semaine, du mois,
 * du trimestre, de l'année ? Même calcul que les alertes du serveur (me-api/src/services/rappels/previsions.ts) :
 * le budget du jour et le hors budget doivent y suivre les mêmes règles que `bilan`.
 */

export const HORIZONS: { key: Horizon; label: string; titre: string }[] = [
  { key: 'jour', label: "Aujourd'hui", titre: 'du jour' },
  { key: 'semaine', label: 'Cette semaine', titre: 'de la semaine' },
  { key: 'mois', label: 'Ce mois', titre: 'du mois' },
  { key: 'trimestre', label: 'Ce trimestre', titre: 'du trimestre' },
  { key: 'annee', label: 'Cette année', titre: "de l'année" },
];

// Avant ces quelques jours, le rythme ne veut encore rien dire : pas d'alerte « à ce rythme ».
export const JOURS_MIN: Record<Periode, number> = { jour: 1, semaine: 2, mois: 5, trimestre: 14, annee: 30 };

export type Etat = 'ok' | 'risque' | 'depasse';
export type Prevision = {
  horizon: Horizon;
  plafond: number;
  depense: number;
  /** Dépense attendue à la fin de l'horizon au rythme actuel (pour le jour : la dépense du jour). */
  projection: number;
  /** Ce qu'on peut dépenser par jour d'ici la fin pour rester dans le budget. */
  parJour: number;
  etat: Etat;
  /** Budgets de catégorie en risque ou dépassés, le plus en difficulté d'abord. */
  budgets: { nom: string; emoji: string; plafond: number; depense: number; projection: number; etat: Etat }[];
};

const arrondi = (n: number) => Math.round(n * 100) / 100;
const jours = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5) + 1;

/** Le budget total est fixé par jour (budget global « par jour », ou seulement des budgets par jour). */
export const budgetJournalier = (f: Finances) => {
  const g = f.budgets.find((b) => b.global);
  return g ? g.periode === 'jour' : f.budgets.length > 0 && f.budgets.every((b) => b.periode === 'jour');
};

/** Plafond total sur les jours `debut`–`fin`, budgets datés compris au prorata de leurs dates (voir `plafondSur`). */
function plafondTotal(f: Finances, vue: Periode, debut: string, fin: string) {
  const g = f.budgets.find((b) => b.global && plafondSur(b, vue, debut, fin) > 0);
  return g ? plafondSur(g, vue, debut, fin) : f.budgets.filter((b) => !b.global).reduce((s, b) => s + plafondSur(b, vue, debut, fin), 0);
}
/**
 * Dépenses du `a` au `b` : celles d'un budget, ou toutes celles qui comptent face au plafond total
 * (toutes avec un budget global, sinon les seules rangées dans un budget, comme dans `bilan`).
 */
const somme = (f: Finances, a: string, b: string, budget?: string) => {
  const global = f.budgets.some((x) => x.global);
  return arrondi(
    f.depenses
      .filter((x) => !x.lien && x.date >= a && x.date <= b && (budget !== undefined ? idBudgetDe(f.budgets, x) === budget : global || !!idBudgetDe(f.budgets, x)))
      .reduce((s, x) => s + x.montant, 0),
  );
};

/** seuil : part du budget à partir de laquelle une prévision est « à risque » (1 = au-delà du budget). */
export function prevision(f: Finances, horizon: Horizon, d: string, seuil = 1): Prevision | null {
  if (!f.budgets.length) return null;
  if (horizon === 'jour') {
    // Le budget du jour est celui du bilan du jour (voir `plafondDuJour` dans finances.ts) : le même chiffre partout.
    const j = bilan(f, 'jour', d, d);
    const etatJour = (x: number, pl: number): Etat => (x > pl ? 'depasse' : x > 0 && x >= seuil * pl ? 'risque' : 'ok');
    const budgets = j.lignes
      .filter((l) => !l.budget.global && l.plafond > 0)
      .map((l) => ({ nom: l.budget.nom, emoji: l.budget.emoji, plafond: l.plafond, depense: l.depense, projection: l.depense, etat: etatJour(l.depense, l.plafond) }))
      .filter((b) => b.etat !== 'ok')
      .sort((a, b) => b.depense / b.plafond - a.depense / a.plafond);
    const pl = j.plafondTotal;
    // Pour tenir : le budget de demain, une fois la dépense d'aujourd'hui retirée (le même montant pour un budget fixé par jour).
    const { fin } = bornes('mois', d);
    const apres = budgetJournalier(f) ? pl : d >= fin ? 0 : budgetDuJour(f, addDays(d, 1));
    return { horizon, plafond: pl, depense: j.compte, projection: j.compte, parJour: apres, etat: etatJour(j.compte, pl), budgets };
  }
  const { debut, fin } = bornes(horizon, d);
  const ecoules = jours(debut, d);
  const total = jours(debut, fin);
  const assez = ecoules >= JOURS_MIN[horizon];
  const etat = (dep: number, pl: number, proj: number): Etat => (dep > pl ? 'depasse' : assez && dep > 0 && proj >= seuil * pl && (seuil < 1 || proj > pl) ? 'risque' : 'ok');
  const pl = arrondi(plafondTotal(f, horizon, debut, fin));
  const dep = somme(f, debut, d);
  const proj = arrondi((dep / ecoules) * total);
  const budgets = f.budgets
    .filter((b) => !b.global)
    .map((b) => {
      const p = plafondSur(b, horizon, debut, fin);
      const x = somme(f, debut, d, b.id);
      const pr = arrondi((x / ecoules) * total);
      return { nom: b.nom, emoji: b.emoji, plafond: p, depense: x, projection: pr, etat: etat(x, p, pr) };
    })
    .filter((b) => b.etat !== 'ok' && (b.plafond > 0 || b.depense > 0))
    .sort((a, b) => b.projection / b.plafond - a.projection / a.plafond);
  return { horizon, plafond: pl, depense: dep, projection: proj, parJour: Math.max(0, arrondi((pl - dep) / jours(d, fin))), etat: etat(dep, pl, proj), budgets };
}

export const previsions = (f: Finances, d: string, seuil = 1) => HORIZONS.map((h) => prevision(f, h.key, d, seuil)).filter((p): p is Prevision => !!p);
