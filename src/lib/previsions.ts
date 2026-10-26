import { addDays, parse } from './dates';
import { bornes, plafond } from './finances';
import type { Finances, Horizon, Periode } from './types';

/**
 * Prévisions de dépenses : au rythme actuel, où en sera-t-on à la fin du jour, de la semaine, du mois,
 * du trimestre, de l'année ? Même calcul que les alertes du serveur (me-api/src/services/rappels/previsions.ts).
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

function plafondTotal(f: Finances, vue: Periode) {
  const g = f.budgets.find((b) => b.global);
  return g ? plafond(g, vue) : f.budgets.reduce((s, b) => s + plafond(b, vue), 0);
}
const somme = (f: Finances, a: string, b: string, budget?: string) => arrondi(f.depenses.filter((x) => !x.lien && x.date >= a && x.date <= b && (budget === undefined || x.budget === budget)).reduce((s, x) => s + x.montant, 0));

/** seuil : part du budget à partir de laquelle une prévision est « à risque » (1 = au-delà du budget). */
export function prevision(f: Finances, horizon: Horizon, d: string, seuil = 1): Prevision | null {
  if (!f.budgets.length) return null;
  if (horizon === 'jour') {
    const auj = somme(f, d, d);
    const etatJour = (x: number, pl: number): Etat => (x > pl ? 'depasse' : x > 0 && x >= seuil * pl ? 'risque' : 'ok');
    // Budgets de catégorie fixés par jour : comparés à la dépense du jour.
    const budgets = f.budgets
      .filter((b) => !b.global && b.periode === 'jour')
      .map((b) => {
        const x = somme(f, d, d, b.id);
        return { nom: b.nom, emoji: b.emoji, plafond: b.montant, depense: x, projection: x, etat: etatJour(x, b.montant) };
      })
      .filter((b) => b.etat !== 'ok')
      .sort((a, b) => b.depense / b.plafond - a.depense / a.plafond);
    if (budgetJournalier(f)) {
      // Budget fixé par jour : le même montant chaque jour, sans report.
      const pl = arrondi(plafondTotal(f, 'jour'));
      return { horizon, plafond: pl, depense: auj, projection: auj, parJour: pl, etat: etatJour(auj, pl), budgets };
    }
    // Sinon, le budget du jour : ce qui reste du mois, réparti sur les jours restants (aujourd'hui compris).
    const { debut, fin } = bornes('mois', d);
    const pl = plafondTotal(f, 'mois');
    const avant = somme(f, debut, addDays(d, -1));
    const parJour = Math.max(0, arrondi((pl - avant) / jours(d, fin)));
    return { horizon, plafond: parJour, depense: auj, projection: auj, parJour: Math.max(0, arrondi((pl - avant - auj) / Math.max(1, jours(d, fin) - 1))), etat: etatJour(auj, parJour), budgets };
  }
  const { debut, fin } = bornes(horizon, d);
  const ecoules = jours(debut, d);
  const total = jours(debut, fin);
  const assez = ecoules >= JOURS_MIN[horizon];
  const etat = (dep: number, pl: number, proj: number): Etat => (dep > pl ? 'depasse' : assez && dep > 0 && proj >= seuil * pl && (seuil < 1 || proj > pl) ? 'risque' : 'ok');
  const pl = arrondi(plafondTotal(f, horizon));
  const dep = somme(f, debut, d);
  const proj = arrondi((dep / ecoules) * total);
  const budgets = f.budgets
    .filter((b) => !b.global)
    .map((b) => {
      const p = plafond(b, horizon);
      const x = somme(f, debut, d, b.id);
      const pr = arrondi((x / ecoules) * total);
      return { nom: b.nom, emoji: b.emoji, plafond: p, depense: x, projection: pr, etat: etat(x, p, pr) };
    })
    .filter((b) => b.etat !== 'ok')
    .sort((a, b) => b.projection / b.plafond - a.projection / a.plafond);
  return { horizon, plafond: pl, depense: dep, projection: proj, parJour: Math.max(0, arrondi((pl - dep) / jours(d, fin))), etat: etat(dep, pl, proj), budgets };
}

export const previsions = (f: Finances, d: string, seuil = 1) => HORIZONS.map((h) => prevision(f, h.key, d, seuil)).filter((p): p is Prevision => !!p);
