import { addDays, parse, ymd } from './dates';
import { fmtDevise } from './devises';
import type { Budget, Depense, Espace, Finances, Periode, Recurrence, Revenu } from './types';

/**
 * Budgets par période : chaque budget a sa périodicité (semaine, mois, trimestre, année).
 * Vu sur une autre période, il est converti au prorata (un budget de 100 € par semaine ≈ 435 € par mois).
 */

export const financesDe = (e: Espace): Finances => ({ devise: '€', budgets: [], depenses: [], ...e.finances });

export const PERIODES: { key: Periode; label: string; par: string }[] = [
  { key: 'jour', label: 'Jour', par: 'par jour' },
  { key: 'semaine', label: 'Semaine', par: 'par semaine' },
  { key: 'mois', label: 'Mois', par: 'par mois' },
  { key: 'trimestre', label: 'Trimestre', par: 'par trimestre' },
  { key: 'annee', label: 'Année', par: 'par an' },
];
export const parPeriode = (p: Periode) => PERIODES.find((x) => x.key === p)!.par;

// Nombre de périodes dans une année, pour convertir un budget d'une périodicité à l'autre.
const PAR_AN: Record<Periode, number> = { jour: 365.25, semaine: 365.25 / 7, mois: 12, trimestre: 4, annee: 1 };

/** Premier et dernier jour (inclus) de la période qui contient la date. */
export function bornes(p: Periode, d: string) {
  const x = parse(d);
  if (p === 'jour') return { debut: d, fin: d };
  if (p === 'semaine') {
    const debut = addDays(d, -((x.getDay() + 6) % 7));
    return { debut, fin: addDays(debut, 6) };
  }
  const mois = p === 'mois' ? x.getMonth() : p === 'trimestre' ? x.getMonth() - (x.getMonth() % 3) : 0;
  const duree = p === 'mois' ? 1 : p === 'trimestre' ? 3 : 12;
  return { debut: ymd(new Date(x.getFullYear(), mois, 1)), fin: ymd(new Date(x.getFullYear(), mois + duree, 0)) };
}

/** La même période, n fois plus tôt (n < 0) ou plus tard. */
export function decaler(p: Periode, d: string, n: number) {
  if (!n) return d;
  if (p === 'jour') return addDays(d, n);
  if (p === 'semaine') return addDays(d, 7 * n);
  const x = parse(bornes(p, d).debut);
  const mois = p === 'mois' ? 1 : p === 'trimestre' ? 3 : 12;
  return ymd(new Date(x.getFullYear(), x.getMonth() + mois * n, 1));
}

const COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function libelle(p: Periode, d: string) {
  const { debut, fin } = bornes(p, d);
  const x = parse(debut);
  if (p === 'jour') {
    const j = JOURS_LONGS[(x.getDay() + 6) % 7];
    return `${j[0].toUpperCase()}${j.slice(1)} ${x.getDate() === 1 ? '1er' : x.getDate()} ${MOIS[x.getMonth()]} ${x.getFullYear()}`;
  }
  if (p === 'semaine') {
    const y = parse(fin);
    const j = (z: Date) => (z.getDate() === 1 ? '1er' : String(z.getDate()));
    return x.getMonth() === y.getMonth() ? `Du ${j(x)} au ${j(y)} ${MOIS[y.getMonth()]}` : `Du ${j(x)} ${COURT[x.getMonth()]} au ${j(y)} ${COURT[y.getMonth()]}`;
  }
  if (p === 'mois') return `${MOIS[x.getMonth()][0].toUpperCase()}${MOIS[x.getMonth()].slice(1)} ${x.getFullYear()}`;
  if (p === 'trimestre') return `${Math.floor(x.getMonth() / 3) + 1}${x.getMonth() ? 'e' : 'er'} trimestre ${x.getFullYear()}`;
  return String(x.getFullYear());
}

const jours = (debut: string, fin: string) => Math.round((parse(fin).getTime() - parse(debut).getTime()) / 864e5) + 1;
const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Plafond d'un budget ramené à la période affichée. */
export const plafond = (b: Budget, vue: Periode) => (b.periode === vue ? b.montant : arrondi((b.montant * PAR_AN[b.periode]) / PAR_AN[vue]));

export const depensesEntre = (f: Finances, debut: string, fin: string) => f.depenses.filter((x) => x.date >= debut && x.date <= fin);
const somme = (l: Depense[]) => arrondi(l.reduce((s, x) => s + x.montant, 0));

export type Ligne = { budget: Budget; plafond: number; depense: number; reste: number; ratio: number; converti: boolean };
export type Bilan = {
  debut: string;
  fin: string;
  depenses: Depense[];
  lignes: Ligne[];
  horsBudget: number;
  total: number;
  /** Plafond global : le budget « toutes les dépenses » s'il existe, sinon la somme des budgets. */
  plafondTotal: number;
  enCours: boolean;
  /** Période en cours : dépense prévue à la fin au rythme actuel, et ce qu'on peut encore dépenser par jour. */
  projection: number | null;
  parJour: number | null;
};

export function bilan(f: Finances, vue: Periode, ref: string, aujourdhui: string): Bilan {
  const { debut, fin } = bornes(vue, ref);
  const dep = depensesEntre(f, debut, fin).sort((a, b) => b.date.localeCompare(a.date) || b.creeLe.localeCompare(a.creeLe));
  const total = somme(dep);
  const ids = new Set(f.budgets.filter((b) => !b.global).map((b) => b.id));
  const lignes = f.budgets.map((b) => {
    const p = plafond(b, vue);
    const d = b.global ? total : somme(dep.filter((x) => x.budget === b.id));
    return { budget: b, plafond: p, depense: d, reste: arrondi(p - d), ratio: p ? d / p : d ? 1.01 : 0, converti: b.periode !== vue };
  });
  const global = lignes.find((l) => l.budget.global);
  const plafondTotal = global ? global.plafond : arrondi(lignes.reduce((s, l) => s + l.plafond, 0));
  const enCours = aujourdhui >= debut && aujourdhui <= fin;
  const ecoules = enCours ? jours(debut, aujourdhui) : 0;
  const restants = enCours ? jours(aujourdhui, fin) : 0;
  return {
    debut,
    fin,
    depenses: dep,
    lignes,
    horsBudget: somme(dep.filter((x) => !x.budget || !ids.has(x.budget))),
    total,
    plafondTotal,
    enCours,
    projection: enCours && total ? arrondi((total / ecoules) * jours(debut, fin)) : null,
    parJour: enCours && plafondTotal ? Math.max(0, arrondi((plafondTotal - total) / restants)) : null,
  };
}

/** Pour l'alerte après une dépense : part de son budget déjà utilisée sur la période propre à ce budget. */
export function usageBudget(f: Finances, b: Budget, d: string) {
  const { debut, fin } = bornes(b.periode, d);
  const dep = depensesEntre(f, debut, fin);
  const d2 = b.global ? somme(dep) : somme(dep.filter((x) => x.budget === b.id));
  return b.montant ? d2 / b.montant : 0;
}

export const fmtMontant = fmtDevise;

/** « 12,50 », « 12.5 », « 1 200 » → nombre ; null si ce n'est pas un montant positif. */
export function lireMontant(s: string) {
  const n = Number(s.replace(/[\s  ]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? arrondi(n) : null;
}

export const EMOJIS_BUDGET = ['🛒', '🍽️', '🚗', '🏠', '🎉', '👕', '💊', '📱', '🎁', '✈️', '📚', '💡', '🐾', '💰'];
export const BUDGETS_SUGGERES: Omit<Budget, 'id'>[] = [
  { nom: 'Courses', emoji: '🛒', montant: 400, periode: 'mois' },
  { nom: 'Sorties', emoji: '🎉', montant: 50, periode: 'semaine' },
  { nom: 'Transport', emoji: '🚗', montant: 120, periode: 'mois' },
  { nom: 'Vacances', emoji: '✈️', montant: 1500, periode: 'annee' },
];

/** Revenus de la période (salaire, remboursements…), pour le solde. */
export const revenusEntre = (f: Finances, debut: string, fin: string) => (f.revenus || []).filter((x) => x.date >= debut && x.date <= fin);
export const totalRevenus = (l: Revenu[]) => arrondi(l.reduce((s, x) => s + x.montant, 0));

export const FREQUENCES: { key: Recurrence['frequence']; label: string; chaque: string }[] = [
  { key: 'semaine', label: 'Chaque semaine', chaque: 'chaque semaine' },
  { key: 'mois', label: 'Chaque mois', chaque: 'chaque mois' },
  { key: 'annee', label: 'Chaque année', chaque: 'chaque année' },
];

/** n-ième échéance d'un paiement récurrent ; un 31 tombe le dernier jour des mois plus courts. */
export function echeance(r: Pick<Recurrence, 'debut' | 'frequence'>, n: number) {
  if (r.frequence === 'semaine') return addDays(r.debut, 7 * n);
  const d = parse(r.debut);
  const mois = d.getMonth() + (r.frequence === 'mois' ? n : 12 * n);
  const dernierJour = new Date(d.getFullYear(), mois + 1, 0).getDate();
  return ymd(new Date(d.getFullYear(), mois, Math.min(d.getDate(), dernierJour)));
}

/** Prochaine échéance après la dernière ajoutée. */
export function prochaineEcheance(r: Recurrence) {
  if (!r.derniere) return r.debut;
  for (let n = 1; n < 5000; n++) {
    const x = echeance(r, n);
    if (x > r.derniere) return x;
  }
  return r.debut;
}

/**
 * Ajoute les échéances passées des paiements récurrents (jusqu'à aujourd'hui inclus). Les identifiants sont
 * déterministes (`récurrence:date`) : deux appareils qui rattrapent la même échéance ne la doublent pas.
 * Renvoie le même objet s'il n'y a rien à ajouter.
 */
export function genererRecurrences(f: Finances, aujourdhui: string): Finances {
  if (!f.recurrences?.length) return f;
  const ids = new Set([...f.depenses.map((x) => x.id), ...(f.revenus || []).map((x) => x.id)]);
  const depenses: Depense[] = [];
  const revenus: Revenu[] = [];
  let change = false;
  const recurrences = f.recurrences.map((r) => {
    let derniere = r.derniere;
    for (let x = prochaineEcheance(r), i = 0; x <= aujourdhui && i < 1000; i++) {
      const id = `${r.id}:${x}`;
      if (!ids.has(id)) {
        const base = { id, montant: r.montant, ...(r.origine ? { origine: r.origine } : {}), note: r.note, date: x, creeLe: new Date().toISOString(), recurrence: r.id };
        if (r.genre === 'revenu') revenus.push(base);
        else depenses.push({ ...base, budget: r.budget });
      }
      derniere = x;
      x = prochaineEcheance({ ...r, derniere: x });
    }
    if (derniere === r.derniere) return r;
    change = true;
    return { ...r, derniere };
  });
  if (!change) return f;
  return { ...f, recurrences, depenses: [...depenses, ...f.depenses], revenus: [...revenus, ...(f.revenus || [])] };
}
