import { parse } from './dates';
import { bilan, bornes, financesDe } from './finances';
import { moisAvant } from './conseils';
import { objectifsActifs } from './objectifs';
import type { Espace } from './types';

/** Chiffres de l'écran Statistiques sur le budget et les objectifs : calculés à partir de l'espace, rien n'est stocké. */

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const arrondi = (n: number) => Math.round(n * 100) / 100;

export type PeriodeStats = '7' | '30' | '90' | 'mois' | 'annee';
export const PERIODES_STATS: { key: PeriodeStats; label: string }[] = [
  { key: '7', label: '7 jours' },
  { key: '30', label: '30 jours' },
  { key: 'mois', label: 'Ce mois' },
  { key: '90', label: '90 jours' },
  { key: 'annee', label: 'Cette année' },
];

/** Nombre de jours de la période, jusqu'à aujourd'hui compris (« Ce mois » : depuis le 1er, « Cette année » : depuis le 1er janvier). */
export function joursDeLaPeriode(p: PeriodeStats, d: string): number {
  if (p === 'mois') return parse(d).getDate();
  if (p === 'annee') return Math.round((parse(d).getTime() - new Date(parse(d).getFullYear(), 0, 1).getTime()) / 864e5) + 1;
  return Number(p);
}

export function titrePeriode(p: PeriodeStats, jours: number) {
  return p === 'mois' ? 'Ce mois' : p === 'annee' ? 'Depuis le 1er janvier' : `Les ${jours} derniers jours`;
}

export type MoisBudget = { cle: string; axe: string; mois: string; plafond: number; depense: number; ratio: number; /** Budget fixé ce mois-là ? Sinon rien à tenir. */ fixe: boolean; tenu: boolean };

/** Le budget total, mois après mois : ce qui était prévu, ce qui a été dépensé, et si le plafond a tenu. */
export function budgetParMois(e: Espace, d: string, n = 6): MoisBudget[] {
  const f = financesDe(e);
  // Avant la première dépense notée, il n'y a rien à juger : un mois vide ne compte pas comme « tenu ».
  const premiere = f.depenses.reduce((m, x) => (x.date < m ? x.date : m), '9999-12-31');
  return Array.from({ length: n }, (_, i) => {
    const debut = moisAvant(d, n - 1 - i);
    const b = bilan(f, 'mois', debut, d);
    const x = parse(debut);
    const fixe = b.plafondTotal > 0 && debut >= `${premiere.slice(0, 8)}01`;
    const depense = b.compte;
    return { cle: debut, axe: MOIS_COURTS[x.getMonth()], mois: `${MOIS_COURTS[x.getMonth()]} ${x.getFullYear()}`, plafond: b.plafondTotal, depense, ratio: fixe ? depense / b.plafondTotal : 0, fixe, tenu: fixe && depense <= b.plafondTotal };
  });
}

export type LigneBudgetMois = { id: string; nom: string; emoji: string; depense: number; plafond: number; ratio: number; reste: number };

/** Chaque budget du mois en cours : le plus utilisé d'abord. Le budget total n'en fait pas partie. */
export function budgetsDuMois(e: Espace, d: string): LigneBudgetMois[] {
  const f = financesDe(e);
  return bilan(f, 'mois', d, d)
    .lignes.filter((l) => !l.budget.global && l.plafond > 0)
    .map((l) => ({ id: l.budget.id, nom: l.budget.nom, emoji: l.budget.emoji, depense: l.depense, plafond: l.plafond, ratio: l.ratio, reste: l.reste }))
    .sort((a, b) => b.ratio - a.ratio);
}

export type MoisVerse = { cle: string; axe: string; mois: string; v: number };

/** Ce qui a été versé sur tous les objectifs en cours, mois après mois (hors point de départ). */
export function verseParMois(e: Espace, d: string, n = 6): MoisVerse[] {
  const f = financesDe(e);
  const versements = objectifsActifs(f).flatMap((o) => o.versements);
  return Array.from({ length: n }, (_, i) => {
    const debut = moisAvant(d, n - 1 - i);
    const { fin } = bornes('mois', debut);
    const x = parse(debut);
    return { cle: debut, axe: MOIS_COURTS[x.getMonth()], mois: `${MOIS_COURTS[x.getMonth()]} ${x.getFullYear()}`, v: arrondi(versements.filter((v) => v.date >= debut && v.date <= fin).reduce((s, v) => s + v.montant, 0)) };
  });
}

/** Mois où le budget total a tenu, sur les mois où il était fixé. */
export function moisTenus(l: MoisBudget[]) {
  const fixes = l.filter((m) => m.fixe);
  return { tenus: fixes.filter((m) => m.tenu).length, sur: fixes.length };
}
