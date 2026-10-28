import { bornes, suiviBudget } from './finances';
import type { Finances, Horizon } from './types';

/**
 * Où en sont les budgets de chaque durée (par jour, par semaine, par mois…) : montant, dépensé, reste, sur la seule
 * base des dépenses notées. Rien n'est projeté ni réparti. Même calcul que les alertes du serveur
 * (me-api/src/commun/previsions.ts) : le chiffre d'une alerte est celui de l'écran.
 */

export const HORIZONS: { key: Horizon; label: string; titre: string }[] = [
  { key: 'jour', label: "Aujourd'hui", titre: 'du jour' },
  { key: 'semaine', label: 'Cette semaine', titre: 'de la semaine' },
  { key: 'mois', label: 'Ce mois', titre: 'du mois' },
  { key: 'trimestre', label: 'Ce trimestre', titre: 'du trimestre' },
  { key: 'annee', label: 'Cette année', titre: "de l'année" },
];

export type Etat = 'ok' | 'risque' | 'depasse';
export type Prevision = {
  horizon: Horizon;
  /** Le total est celui d'un budget « toutes les dépenses » ; sinon c'est la somme des budgets de catégorie. */
  global: boolean;
  /** Premier jour de la période suivie (celle du budget global s'il y en a un). */
  debut: string;
  plafond: number;
  depense: number;
  reste: number;
  etat: Etat;
  /** Budgets de catégorie presque atteints ou dépassés, le plus en difficulté d'abord. */
  budgets: { nom: string; emoji: string; debut: string; plafond: number; depense: number; reste: number; etat: Etat }[];
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * Les budgets fixés pour cette durée et en cours le jour `d`. `seuil` : part du budget à partir de laquelle il est
 * « presque atteint » (1 = atteint). null sans budget de cette durée.
 */
export function prevision(f: Finances, horizon: Horizon, d: string, seuil = 1): Prevision | null {
  const suivis = f.budgets
    .filter((b) => b.periode === horizon)
    .map((b) => ({ b, s: suiviBudget(f, b, d) }))
    .filter((x): x is { b: (typeof f.budgets)[number]; s: NonNullable<ReturnType<typeof suiviBudget>> } => !!x.s);
  if (!suivis.length) return null;
  const etat = (x: number, pl: number): Etat => (x > pl ? 'depasse' : x > 0 && x >= seuil * pl ? 'risque' : 'ok');
  const g = suivis.find((x) => x.b.global);
  const autres = suivis.filter((x) => !x.b.global);
  const pl = g ? g.s.total : arrondi(autres.reduce((s, x) => s + x.s.total, 0));
  const dep = g ? g.s.depense : arrondi(autres.reduce((s, x) => s + x.s.depense, 0));
  const budgets = autres
    .map(({ b, s }) => ({ nom: b.nom, emoji: b.emoji, debut: s.debut, plafond: s.total, depense: s.depense, reste: s.reste, etat: etat(s.depense, s.total) }))
    .filter((b) => b.etat !== 'ok')
    .sort((a, b) => b.depense / (b.plafond || 1) - a.depense / (a.plafond || 1));
  return { horizon, global: !!g, debut: g?.s.debut ?? bornes(horizon, d).debut, plafond: pl, depense: dep, reste: arrondi(pl - dep), etat: etat(dep, pl), budgets };
}

export const previsions = (f: Finances, d: string, seuil = 1) => HORIZONS.map((h) => prevision(f, h.key, d, seuil)).filter((p): p is Prevision => !!p);
