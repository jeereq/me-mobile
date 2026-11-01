import { addDays, parse } from './dates';
import { bilan, type Bilan, decaler, libelle, type Ligne } from './finances';
import type { Finances, Periode } from './types';

/** Nombre de jours de `a` à `b`, les deux compris. */
const nbJours = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5) + 1;
const arrondi = (x: number) => Math.round(x * 100) / 100;

/** La part d'une période déjà écoulée, aujourd'hui compris : 0 avant son début, 1 une fois finie. */
export function partEcoulee(debut: string, fin: string, d: string) {
  if (d < debut) return 0;
  if (d > fin) return 1;
  return nbJours(debut, d) / nbJours(debut, fin);
}

export type EtatRythme = 'sans' | 'avenir' | 'rythme' | 'avance' | 'depasse' | 'termine';

export type Rythme = {
  etat: EtatRythme;
  /** Ce qu'il reste à dépenser dans les budgets (négatif : dépassé). */
  reste: number;
  ratio: number;
  /** Ce qu'on peut dépenser par jour jusqu'à la fin de la période, aujourd'hui compris (null si ça n'a pas de sens). */
  parJour: number | null;
  joursRestants: number;
  /** De combien de jours on a pris de l'avance sur le rythme prévu (0 si on est dans le rythme). */
  avance: number;
  /** La part de la période écoulée, pour le trait « aujourd'hui » de la jauge (null hors de la période). */
  repere: number | null;
};

/**
 * Où en est la période affichée face à ses budgets : ce qui reste, par jour jusqu'à la fin, et si l'on dépense plus vite
 * que prévu. « En avance » : ce qui est déjà dépensé aurait dû suffire jusqu'à un jour plus tard qu'aujourd'hui.
 */
export function rythme(b: Bilan, d: string): Rythme {
  const reste = arrondi(b.plafondTotal - b.compte);
  const ratio = b.plafondTotal ? b.compte / b.plafondTotal : 0;
  const base = { reste, ratio, parJour: null, joursRestants: 0, avance: 0, repere: null };
  if (!b.plafondTotal) return { ...base, etat: 'sans' };
  if (reste < 0) return { ...base, etat: 'depasse', repere: b.enCours ? partEcoulee(b.debut, b.fin, d) : null };
  if (b.fin < d) return { ...base, etat: 'termine' };
  if (b.debut > d) return { ...base, etat: 'avenir', joursRestants: nbJours(b.debut, b.fin) };
  const total = nbJours(b.debut, b.fin);
  const ecoules = nbJours(b.debut, d);
  const joursRestants = nbJours(d, b.fin);
  const parJourPrevu = b.plafondTotal / total;
  const avance = Math.max(0, Math.round((b.compte - parJourPrevu * ecoules) / parJourPrevu));
  const brut = reste / joursRestants;
  const parJour = total > 1 && reste > 0 ? (brut >= 10 ? Math.floor(brut) : Math.floor(brut * 100) / 100) : null;
  return { reste, ratio, parJour, joursRestants, avance, repere: partEcoulee(b.debut, b.fin, d), etat: avance >= 1 ? 'avance' : 'rythme' };
}

/**
 * Plus un budget est pressant, plus le nombre est grand : d'abord les dépassés, puis ceux qui se vident plus vite que
 * le temps ne passe (un budget à 60 % le 10 du mois passe avant un budget à 70 % le 28).
 */
export function urgence(l: Ligne, d: string) {
  if (l.reste < 0) return 10 + l.ratio;
  return l.ratio - partEcoulee(l.debut, l.fin, d);
}

/** Un budget à surveiller : dépassé, presque vide, ou qui se vide nettement plus vite que la période ne passe. */
export function aSurveiller(l: Ligne, d: string) {
  if (!l.plafond) return false;
  return l.reste < 0 || l.ratio >= 0.9 || (d >= l.debut && d <= l.fin && l.ratio - partEcoulee(l.debut, l.fin, d) > 0.1);
}

/** Les budgets du plus pressant au moins pressant. */
export const parUrgence = (lignes: Ligne[], d: string) => [...lignes].sort((x, y) => urgence(y, d) - urgence(x, d));

/** La période d'avant, à glisser après « vs » : « septembre », « la semaine d'avant ». */
export function nomPrecedente(vue: Periode, jourRef: string) {
  const avant = decaler(vue, jourRef, -1);
  if (vue === 'mois') return libelle('mois', avant).split(' ')[0].toLowerCase();
  if (vue === 'annee') return libelle('annee', avant);
  return vue === 'jour' ? 'la veille' : vue === 'semaine' ? 'la semaine d’avant' : 'le trimestre d’avant';
}

export type Comparaison = {
  /** Ce qui avait été dépensé sur la période d'avant, à la même date si la période affichée est en cours. */
  avant: number;
  /** L'écart en pourcentage (null si rien n'avait été dépensé). */
  ecart: number | null;
  memeDate: boolean;
  nom: string;
};

/**
 * Comparer une période en cours à la précédente entière n'a pas de sens le 18 du mois : on compare à ce qui avait été
 * dépensé à la même date (du 1er au 18 septembre). Une période finie se compare à la précédente entière.
 */
export function comparaison(f: Finances, vue: Periode, jourRef: string, d: string, b: Bilan = bilan(f, vue, jourRef, d)): Comparaison {
  const prec = bilan(f, vue, decaler(vue, jourRef, -1), d);
  const memeDate = b.enCours && b.fin > d;
  let avant = prec.total;
  if (memeDate) {
    const limite = addDays(prec.debut, nbJours(b.debut, d) - 1);
    avant = arrondi(prec.depenses.filter((x) => x.date <= limite).reduce((s, x) => s + x.montant, 0));
  }
  return { avant, ecart: avant ? Math.round(((b.total - avant) / avant) * 100) : null, memeDate, nom: nomPrecedente(vue, jourRef) };
}
