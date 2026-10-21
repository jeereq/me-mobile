import { addDays, parse } from './dates';
import { bilan, decaler, depensesEntre, libelle } from './finances';
import type { Depense, Finances, Periode } from './types';

/** Statistiques de dépenses autour de la période affichée ; tout est calculé à la volée depuis les dépenses. */

const COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const JOURS_SEMAINE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const HISTORIQUE: Record<Periode, number> = { jour: 14, semaine: 12, mois: 12, trimestre: 8, annee: 5 };
const arrondi = (n: number) => Math.round(n * 100) / 100;
const jours = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5) + 1;

/** Libellé court d'une période sous une barre de graphique. */
function axe(p: Periode, debut: string) {
  const x = parse(debut);
  if (p === 'jour') return `${'LMMJVSD'[(x.getDay() + 6) % 7]} ${x.getDate()}`;
  if (p === 'semaine') return `${x.getDate()}/${x.getMonth() + 1}`;
  if (p === 'mois') return COURT[x.getMonth()].replace('.', '');
  if (p === 'trimestre') return `T${Math.floor(x.getMonth() / 3) + 1} ${String(x.getFullYear()).slice(2)}`;
  return String(x.getFullYear());
}

export function statsFinances(f: Finances, vue: Periode, ref: string, aujourdhui: string) {
  const b = bilan(f, vue, ref, aujourdhui);

  // Historique : les périodes précédentes jusqu'à celle affichée, en partant de la première dépense notée.
  const premiere = f.depenses.reduce((m, x) => (x.date < m ? x.date : m), b.debut);
  const historique = Array.from({ length: HISTORIQUE[vue] }, (_, i) => {
    const r = decaler(vue, ref, i - HISTORIQUE[vue] + 1);
    const x = bilan(f, vue, r, aujourdhui);
    return { cle: x.debut, axe: axe(vue, x.debut), v: x.total, plafond: x.plafondTotal, libelle: libelle(vue, r), fin: x.fin };
  }).filter((x) => x.fin >= premiere);
  const passees = historique.slice(0, -1);
  const moyenne = passees.length ? arrondi(passees.reduce((s, x) => s + x.v, 0) / passees.length) : null;
  const avecPlafond = passees.filter((x) => x.plafond > 0);
  const tenues = avecPlafond.filter((x) => x.v <= x.plafond).length;

  // La période affichée : rythme, nombre, panier moyen, plus grosse dépense.
  const dep = b.depenses;
  const finCompte = b.enCours ? aujourdhui : b.fin;
  const joursEcoules = finCompte >= b.debut ? jours(b.debut, finCompte) : 0;
  const plusGrosse = dep.reduce<Depense | null>((m, x) => (!m || x.montant > m.montant ? x : m), null);

  // Par jour de la semaine, sur toutes les périodes de l'historique (assez de dépenses pour voir une tendance).
  const debutHisto = historique[0]?.cle ?? b.debut;
  const large = depensesEntre(f, debutHisto, b.fin);
  const parJour = Array(7).fill(0) as number[];
  for (const x of large) parJour[(parse(x.date).getDay() + 6) % 7] += x.montant;
  const maxJour = Math.max(...parJour);

  // Où part l'argent : les notes qui reviennent le plus sur la période (« Marché », « Uber »…).
  const notes = new Map<string, { nom: string; v: number; n: number }>();
  for (const x of dep) {
    const nom = x.note.trim();
    if (!nom) continue;
    const k = nom.toLowerCase();
    const e = notes.get(k) || { nom, v: 0, n: 0 };
    e.v += x.montant;
    e.n++;
    notes.set(k, e);
  }
  const postes = [...notes.values()].map((x) => ({ ...x, v: arrondi(x.v) })).sort((a, z) => z.v - a.v).slice(0, 5);

  // Par budget : part de la période et écart avec la période précédente.
  const avant = bilan(f, vue, decaler(vue, ref, -1), aujourdhui);
  const parBudget = [
    ...b.lignes
      .filter((l) => !l.budget.global)
      .map((l) => ({ id: l.budget.id, nom: `${l.budget.emoji} ${l.budget.nom}`, v: l.depense, avant: avant.lignes.find((y) => y.budget.id === l.budget.id)?.depense ?? 0 })),
    { id: 'hors', nom: '💸 Hors budget', v: b.horsBudget, avant: avant.horsBudget },
  ]
    .filter((x) => x.v > 0 || x.avant > 0)
    .sort((a, z) => z.v - a.v);

  return {
    bilan: b,
    historique,
    moyenne,
    respect: avecPlafond.length ? { tenues, sur: avecPlafond.length } : null,
    nombre: dep.length,
    panier: dep.length ? arrondi(b.total / dep.length) : null,
    parJourMoyen: joursEcoules ? arrondi(b.total / joursEcoules) : null,
    plusGrosse,
    joursSansDepense: joursEcoules ? joursEcoules - new Set(dep.map((x) => x.date)).size : null,
    joursEcoules,
    parJourSemaine: parJour.map((v, i) => ({ jour: JOURS_SEMAINE[i], v: arrondi(v) })),
    jourLePlusCher: maxJour > 0 ? JOURS_SEMAINE[parJour.indexOf(maxJour)] : null,
    postes,
    parBudget,
    totalAvant: avant.total,
  };
}

/** « 20/10/2026 », « 20/10 » (année en cours) ou « 2026-10-20 » → « 2026-10-20 » ; null si la date n'existe pas. */
export function lireDate(s: string, aujourdhui: string) {
  const t = s.trim();
  let a: number, m: number, j: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const fr = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(t);
  if (iso) [a, m, j] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (fr) [j, m, a] = [Number(fr[1]), Number(fr[2]), fr[3] ? Number(fr[3].length === 2 ? `20${fr[3]}` : fr[3]) : Number(aujourdhui.slice(0, 4))];
  else return null;
  const d = new Date(a, m - 1, j);
  if (d.getFullYear() !== a || d.getMonth() !== m - 1 || d.getDate() !== j) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
}

export const dateFr = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

/** Titre d'un groupe de dépenses dans la liste : « Aujourd'hui », « Hier », « Lundi 13 oct. ». */
export function titreJour(s: string, aujourdhui: string) {
  if (s === aujourdhui) return "Aujourd'hui";
  if (s === addDays(aujourdhui, -1)) return 'Hier';
  const x = parse(s);
  const j = JOURS_SEMAINE[(x.getDay() + 6) % 7];
  return `${j[0].toUpperCase()}${j.slice(1)} ${x.getDate()} ${COURT[x.getMonth()]}${s.slice(0, 4) !== aujourdhui.slice(0, 4) ? ` ${s.slice(0, 4)}` : ''}`;
}

