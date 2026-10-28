import { idBudgetDe } from './categories';
import { addDays, parse, today, ymd } from './dates';
import { fmtDevise } from './devises';
import type { Budget, CaseBudget, Depense, Espace, Finances, Periode, Poste, Recurrence, Report, Revenu } from './types';

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

/** Combien de périodes séparent celle de `de` de celle de `vers` (négatif si `vers` est plus tôt) : le décalage à donner à `decaler`. */
export function ecartPeriodes(p: Periode, de: string, vers: string) {
  const a = parse(bornes(p, de).debut);
  const z = parse(bornes(p, vers).debut);
  if (p === 'jour' || p === 'semaine') return Math.round((z.getTime() - a.getTime()) / 864e5 / (p === 'jour' ? 1 : 7));
  const mois = (z.getFullYear() - a.getFullYear()) * 12 + z.getMonth() - a.getMonth();
  return p === 'mois' ? mois : p === 'trimestre' ? mois / 3 : mois / 12;
/** De combien de périodes `cible` est éloignée de `d` (négatif : avant), pour la période `p`. */
export function decalagePour(p: Periode, d: string, cible: string) {
  const a = parse(bornes(p, d).debut);
  const z = parse(bornes(p, cible).debut);
  if (p === 'jour') return Math.round((z.getTime() - a.getTime()) / 864e5);
  if (p === 'semaine') return Math.round((z.getTime() - a.getTime()) / (7 * 864e5));
  const mois = (z.getFullYear() - a.getFullYear()) * 12 + z.getMonth() - a.getMonth();
  return p === 'mois' ? mois : p === 'trimestre' ? Math.round(mois / 3) : z.getFullYear() - a.getFullYear();
}

/**
 * Après un import, où regarder les budgets : `null` si l'une des dates importées est déjà dans la période affichée
 * (`jourRef`, vue `vue`) ; sinon la période qui contient la date la plus récente. Un jour ou une semaine est trop court
 * pour un relevé : on passe alors au mois. Les opérations importées gardent la date de la banque, elles ne comptent
 * que dans la période de cette date.
 */
export function periodePourDates(vue: Periode, jourRef: string, aujourdhui: string, dates: string[]): { vue: Periode; decal: number } | null {
  if (!dates.length) return null;
  const { debut, fin } = bornes(vue, jourRef);
  if (dates.some((x) => x >= debut && x <= fin)) return null;
  const recente = [...dates].sort()[dates.length - 1];
  const p: Periode = vue === 'jour' || vue === 'semaine' ? 'mois' : vue;
  return { vue: p, decal: decalagePour(p, aujourdhui, recente) };
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

/**
 * Plafond d'un budget sur les jours `debut`–`fin` de la période affichée, en tenant compte de ses dates :
 * un budget « jusqu'au 15 décembre » ne compte que jusque-là (au prorata des jours), une enveloppe
 * (montant pour toute la durée) est répartie sur ses jours.
 */
export function plafondSur(b: Budget, vue: Periode, debut: string, fin: string) {
  const a = b.debut && b.debut > debut ? b.debut : debut;
  const z = b.fin && b.fin < fin ? b.fin : fin;
  if (a > z) return 0;
  if (b.enveloppe && b.debut && b.fin) return arrondi((b.montant * jours(a, z)) / jours(b.debut, b.fin));
  const p = plafond(b, vue);
  return a === debut && z === fin ? p : arrondi((p * jours(a, z)) / jours(debut, fin));
}

/* ---------- Restes reportés ---------- */

/** Les reports qui comptent : un versement sur un objectif n'en est un que tant que le versement existe encore. */
export function reportsValides(f: Finances): Report[] {
  const verses = new Set((f.objectifs ?? []).flatMap((o) => o.versements.map((v) => v.report).filter(Boolean)));
  return (f.reports ?? []).filter((r) => r.montant > 0 && (!('objectif' in r.vers) || verses.has(r.id)));
}

/** Ce que les reports retirent (départ) et ajoutent (arrivée) à un budget, période par période. */
function mouvementsReports(f: Finances, budget: string) {
  const l: { c: CaseBudget; m: number }[] = [];
  for (const r of reportsValides(f)) {
    if (r.de.budget === budget) l.push({ c: r.de, m: -r.montant });
    if (!('objectif' in r.vers) && r.vers.budget === budget) l.push({ c: r.vers, m: r.montant });
  }
  return l;
}

/** Part d'une période reportée qui tombe dans les jours `debut`–`fin`, au prorata des jours (1 si elle y est toute). */
function partCase(c: CaseBudget, debut: string, fin: string) {
  const z0 = bornes(c.periode, c.debut).fin;
  const a = c.debut > debut ? c.debut : debut;
  const z = z0 < fin ? z0 : fin;
  return a > z ? 0 : jours(a, z) / jours(c.debut, z0);
}

/**
 * Ce que les reports changent au plafond d'un budget sur les jours `debut`–`fin` : un reste reporté sur la semaine
 * compte en entier dans la vue Semaine, au prorata des jours dans une vue Jour ou un mois à cheval.
 */
export function ajustementReports(f: Finances, budget: string, debut: string, fin: string) {
  return arrondi(mouvementsReports(f, budget).reduce((s, x) => s + x.m * partCase(x.c, debut, fin), 0));
}

/** Plafond d'un budget sur les jours `debut`–`fin`, restes reportés compris (voir `plafondSur`). */
export const plafondPeriode = (f: Finances, b: Budget, vue: Periode, debut: string, fin: string) => arrondi(plafondSur(b, vue, debut, fin) + ajustementReports(f, b.id, debut, fin));

/** Un budget daté est-il en cours, à venir ou terminé ce jour-là ? */
export const etatBudget = (b: Budget, d: string) => (b.fin && b.fin < d ? 'termine' : b.debut && b.debut > d ? 'a_venir' : 'en_cours');

/**
 * Suivi d'un budget daté sur toute sa durée (du début, ou de sa création, jusqu'à sa fin) : dépensé, reste,
 * et ce qu'on peut encore dépenser par jour d'ici la fin. Pour une enveloppe, c'est le chiffre qui compte.
 */
export function suiviBudgetDate(f: Finances, b: Budget, aujourdhui: string) {
  if (!b.fin) return null;
  const debut = b.debut || aujourdhui;
  const dep = depensesEntre(f, debut, b.fin);
  const depense = b.global ? somme(dep) : somme(dep.filter((x) => idBudgetDe(f.budgets, x) === b.id));
  // Budget qui revient (« 400 € par mois jusqu'au 15 décembre ») : son montant au prorata des jours couverts.
  const total = b.enveloppe ? b.montant : (b.montant * PAR_AN[b.periode] * jours(debut, b.fin)) / 365.25;
  const restants = aujourdhui > b.fin ? 0 : jours(aujourdhui < debut ? debut : aujourdhui, b.fin);
  const reste = arrondi(total - depense);
  return { debut, fin: b.fin, total: arrondi(total), depense, reste, joursRestants: restants, parJour: restants && reste > 0 ? arrondi(reste / restants) : 0 };
}

/**
 * Le plan de dépenses d'un budget : pour chaque poste, ce qui était prévu et ce qui a déjà été dépensé dessus.
 * `prevu` est ramené à la part de plafond qui compte sur la période affichée (un budget mensuel vu à la semaine,
 * un budget daté au prorata des jours), pour que « prévu » et « dépensé » se comparent.
 */
/** Où en est un poste par rapport à ses dates : avant son début, pendant, ou après sa fin. Sans dates, il court tout le temps. */
export type EtatPoste = 'avenir' | 'encours' | 'termine';
export const etatPoste = (p: Poste, d: string): EtatPoste => (p.debut && d < p.debut ? 'avenir' : p.fin && d > p.fin ? 'termine' : 'encours');

export type SuiviPoste = {
  poste: Poste;
  prevu: number;
  depense: number;
  reste: number;
  ratio: number;
  etat: EtatPoste;
  /** Dépensé plus que prévu sur ce poste. */
  depasse: boolean;
  /** La date de fin est passée et il reste de l'argent dessus : à réaffecter ou à garder de côté. */
  resteApres: boolean;
};

export function suiviPlan(b: Budget, depenses: Depense[], plafondPeriode: number, d = today()) {
  const plan = b.plan ?? [];
  if (!plan.length) return null;
  const total = arrondi(plan.reduce((s, p) => s + p.montant, 0));
  // Plan plus large ou plus serré que le budget de la période : les prévus suivent la même échelle que le plafond.
  const echelle = total > 0 && plafondPeriode > 0 ? plafondPeriode / b.montant : 1;
  const postes: SuiviPoste[] = plan.map((p) => {
    const prevu = arrondi(p.montant * echelle);
    const depense = somme(depenses.filter((x) => x.poste === p.id));
    const reste = arrondi(prevu - depense);
    const etat = etatPoste(p, d);
    return { poste: p, prevu, depense, reste, ratio: prevu ? depense / prevu : depense ? 1.01 : 0, etat, depasse: reste < 0, resteApres: etat === 'termine' && reste > 0 };
  });
  const horsPostes = somme(depenses.filter((x) => !x.poste || !plan.some((p) => p.id === x.poste)));
  return { postes, total, nonAffecte: arrondi(b.montant - total), horsPostes, enCours: postes.filter((x) => x.etat === 'encours'), aVenir: postes.filter((x) => x.etat === 'avenir'), termines: postes.filter((x) => x.etat === 'termine') };
}

/** Les dépenses comptées comme versement d'un objectif (voir `objectifs.ts`) : de l'argent mis de côté, pas consommé. */
export const versementsObjectifs = (f: Finances) => new Set((f.objectifs ?? []).flatMap((o) => o.versements.map((v) => v.depense).filter((x): x is string => !!x)));

/**
 * Les dépenses de la période, celles qui comptent partout (totaux, budgets, prévisions, analyses).
 * N'en font pas partie : les moitiés de virement entre deux de mes comptes (`lien`), ni dépenses ni revenus,
 * et les versements vers un objectif, qui sont de l'argent mis de côté (voir `epargneEntre`).
 */
export function depensesEntre(f: Finances, debut: string, fin: string) {
  const epargne = versementsObjectifs(f);
  return f.depenses.filter((x) => x.date >= debut && x.date <= fin && !x.lien && !epargne.has(x.id));
}

/** Les versements vers un objectif notés comme dépenses sur la période : ce qu'ils représentent, mis à part des dépenses. */
export function epargneEntre(f: Finances, debut: string, fin: string) {
  const epargne = versementsObjectifs(f);
  const l = f.depenses.filter((x) => epargne.has(x.id) && x.date >= debut && x.date <= fin);
  return { nb: l.length, total: arrondi(l.reduce((s, x) => s + x.montant, 0)) };
}
const somme = (l: Depense[]) => arrondi(l.reduce((s, x) => s + x.montant, 0));

export type Ligne = { budget: Budget; plafond: number; depense: number; reste: number; ratio: number; converti: boolean; /** Restes reportés sur la période : reçus (positif) moins partis (négatif), déjà dans `plafond`. */ reporte: number };
export type Bilan = {
  debut: string;
  fin: string;
  depenses: Depense[];
  lignes: Ligne[];
  horsBudget: number;
  total: number;
  /**
   * Ce qui compte face au plafond : tout, avec un budget « toutes les dépenses » ; sinon les seules dépenses
   * rangées dans un budget (une dépense hors budget ne mange pas le budget des courses).
   */
  compte: number;
  /** Plafond global : le budget « toutes les dépenses » s'il existe, sinon la somme des budgets. */
  plafondTotal: number;
  enCours: boolean;
  /** Période en cours : dépense prévue à la fin au rythme actuel. */
  projection: number | null;
  /** Période en cours : le budget d'aujourd'hui (voir `budgetDuJour`), le même chiffre sur tous les écrans. */
  parJour: number | null;
};

/**
 * Le plafond d'un budget pour la seule journée `d`. Un budget fixé par jour donne son montant ; les autres donnent
 * ce qui leur reste sur la semaine (budget à la semaine) ou le mois (dépenses d'avant ce jour retirées), réparti sur
 * les jours restants, ce jour compris.
 * C'est la seule définition du « budget du jour » : Aperçu, Jour par jour, Analyses, Prévisions et accueil s'en servent.
 */
function plafondDuJour(f: Finances, b: Budget, d: string, rangee: (x: Depense) => string | null) {
  if (b.periode === 'jour' && !b.enveloppe) return Math.max(0, plafondPeriode(f, b, 'jour', d, d));
  // Un budget à la semaine se répartit sur sa semaine (ce qu'on a dépensé lundi compte dès mardi) ; les autres sur le mois.
  const cadre: Periode = b.periode === 'semaine' && !b.enveloppe ? 'semaine' : 'mois';
  const { debut, fin } = bornes(cadre, d);
  if (etatBudget(b, d) !== 'en_cours') return 0;
  const z = b.fin && b.fin < fin ? b.fin : fin;
  const a = b.debut && b.debut > debut ? b.debut : debut;
  const pl = plafondSur(b, cadre, debut, fin);
  const avant = d > a ? somme(depensesEntre(f, a, addDays(d, -1)).filter((x) => b.global || rangee(x) === b.id)) : 0;
  // Restes reportés : ceux d'une semaine ou d'un mois entrent dans ce qui se répartit ; celui d'un jour passé aussi
  // (dépensé ou non, il est déjà dans « avant » ou dans ce qui reste) ; celui d'aujourd'hui compte pour aujourd'hui seul,
  // et celui d'un jour à venir attend ce jour-là.
  let commun = 0;
  let ceJour = 0;
  for (const x of mouvementsReports(f, b.id)) {
    if (x.c.periode !== 'jour') commun += x.m * partCase(x.c, a, z);
    else if (x.c.debut >= a && x.c.debut < d) commun += x.m;
    else if (x.c.debut === d) ceJour += x.m;
  }
  return Math.max(0, arrondi(Math.max(0, (pl + commun - avant) / jours(d, z)) + ceJour));
}

export function bilan(f: Finances, vue: Periode, ref: string, aujourdhui: string): Bilan {
  const { debut, fin } = bornes(vue, ref);
  const dep = depensesEntre(f, debut, fin).sort((a, b) => b.date.localeCompare(a.date) || b.creeLe.localeCompare(a.creeLe));
  const total = somme(dep);
  // Le budget d'une dépense : celui choisi à la main, sinon celui qui suit l'une de ses catégories (voir `categories.ts`).
  const rangee = new Map(dep.map((x) => [x.id, idBudgetDe(f.budgets, x)]));
  const budgetDe = (x: Depense) => (rangee.has(x.id) ? rangee.get(x.id)! : idBudgetDe(f.budgets, x));
  const lignes = f.budgets
    .map((b) => {
      const p = vue === 'jour' ? plafondDuJour(f, b, debut, budgetDe) : plafondPeriode(f, b, vue, debut, fin);
      const d = b.global ? total : somme(dep.filter((x) => rangee.get(x.id) === b.id));
      const reporte = ajustementReports(f, b.id, debut, fin);
      return { budget: b, plafond: p, depense: d, reste: arrondi(p - d), ratio: p ? d / p : d ? 1.01 : 0, converti: b.periode !== vue || !!b.enveloppe || plafondSur(b, vue, debut, fin) !== plafond(b, vue), reporte };
    })
    // Un budget daté qui ne couvre pas la période (terminé ou à venir) n'y apparaît que s'il a des dépenses.
    .filter((l) => l.plafond > 0 || l.depense > 0 || (!l.budget.fin && !l.budget.debut));
  const global = lignes.find((l) => l.budget.global);
  const plafondTotal = global ? global.plafond : arrondi(lignes.reduce((s, l) => s + l.plafond, 0));
  const horsBudget = somme(dep.filter((x) => !rangee.get(x.id)));
  const compte = global ? total : arrondi(total - horsBudget);
  const enCours = aujourdhui >= debut && aujourdhui <= fin;
  const ecoules = enCours ? jours(debut, aujourdhui) : 0;
  return {
    debut,
    fin,
    depenses: dep,
    lignes,
    horsBudget,
    total,
    compte,
    plafondTotal,
    enCours,
    projection: enCours && compte ? arrondi((compte / ecoules) * jours(debut, fin)) : null,
    parJour: !enCours || !plafondTotal ? null : vue === 'jour' ? plafondTotal : budgetDuJour(f, aujourdhui),
  };
}

/** Le budget d'une journée : ce qu'on peut dépenser ce jour-là pour tenir ses budgets (voir `plafondDuJour`). */
export const budgetDuJour = (f: Finances, d: string) => bilan(f, 'jour', d, d).plafondTotal;

/** Pour l'alerte après une dépense : part de son budget déjà utilisée sur la période propre à ce budget. */
export function usageBudget(f: Finances, b: Budget, d: string) {
  if (b.fin && (b.enveloppe || d > b.fin)) {
    const s = suiviBudgetDate(f, b, d);
    return s && s.total ? s.depense / s.total : 0;
  }
  const { debut, fin } = bornes(b.periode, d);
  const dep = depensesEntre(f, debut, fin);
  const d2 = b.global ? somme(dep) : somme(dep.filter((x) => idBudgetDe(f.budgets, x) === b.id));
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
export const revenusEntre = (f: Finances, debut: string, fin: string) => (f.revenus || []).filter((x) => x.date >= debut && x.date <= fin && !x.lien);
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
    // Un paiement « jusqu'au 30 juin » s'arrête à cette date.
    const limite = r.fin && r.fin < aujourdhui ? r.fin : aujourdhui;
    for (let x = prochaineEcheance(r), i = 0; x <= limite && i < 1000; i++) {
      const id = `${r.id}:${x}`;
      if (!ids.has(id)) {
        const base = { id, montant: r.montant, ...(r.origine ? { origine: r.origine } : {}), ...(r.categories?.length ? { categories: r.categories } : {}), note: r.note, date: x, creeLe: new Date().toISOString(), recurrence: r.id };
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
