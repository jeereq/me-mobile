import { idBudgetDe } from './categories';
import { addDays, parse, today, ymd } from './dates';
import { fmtDevise } from './devises';
import type { Budget, CaseBudget, Depense, Espace, Finances, Periode, Poste, Recurrence, Report, Revenu } from './types';

/**
 * Budgets par période : chaque budget a sa périodicité (jour, semaine, mois, trimestre, année) ou couvre une durée
 * (une enveloppe). Il se suit toujours sur sa propre période : son montant moins les dépenses notées et rangées dedans.
 * Rien n'est supposé : pas de budget du jour tiré d'un budget au mois, pas de conversion d'une période à l'autre,
 * pas de rythme prolongé jusqu'à la fin de la période.
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
}

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

/** Un budget daté est-il en cours, à venir ou terminé ce jour-là ? */
export const etatBudget = (b: Budget, d: string) => (b.fin && b.fin < d ? 'termine' : b.debut && b.debut > d ? 'a_venir' : 'en_cours');

/**
 * La période d'un budget qui contient `d`, bornée par ses dates : toute la durée d'une enveloppe, sinon le jour,
 * la semaine, le mois… de sa périodicité. null si le budget ne court pas ce jour-là.
 * C'est sur elle que se comptent son montant, ses dépenses et son reste, quelle que soit la période affichée.
 */
export function fenetre(b: Budget, d: string): { debut: string; fin: string } | null {
  if (etatBudget(b, d) !== 'en_cours') return null;
  if (b.enveloppe && b.debut && b.fin) return { debut: b.debut, fin: b.fin };
  const p = bornes(b.periode, d);
  return { debut: b.debut && b.debut > p.debut ? b.debut : p.debut, fin: b.fin && b.fin < p.fin ? b.fin : p.fin };
}

/** Le montant d'un budget sur sa période `debut`–`fin`, restes reportés compris. */
export const plafondFenetre = (f: Finances, b: Budget, debut: string, fin: string) => arrondi(b.montant + ajustementReports(f, b.id, debut, fin));

/** Ce qui a été dépensé dans un budget du `debut` au `fin` : tout pour le budget global, sinon les dépenses rangées dedans. */
export const depenseBudget = (f: Finances, b: Budget, debut: string, fin: string) => somme(depensesEntre(f, debut, fin).filter((x) => b.global || idBudgetDe(f.budgets, x) === b.id));

/**
 * Un budget sur sa période qui contient `d` : montant (restes reportés compris), dépensé, reste. null s'il ne court
 * pas ce jour-là. Pour une enveloppe, c'est le suivi de toute sa durée.
 */
export function suiviBudget(f: Finances, b: Budget, d: string) {
  const w = fenetre(b, d);
  if (!w) return null;
  const total = plafondFenetre(f, b, w.debut, w.fin);
  const depense = depenseBudget(f, b, w.debut, w.fin);
  return { ...w, total, depense, reste: arrondi(total - depense) };
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

export type Ligne = {
  budget: Budget;
  plafond: number;
  depense: number;
  reste: number;
  ratio: number;
  /** La période du budget sur laquelle tout se compte (voir `fenetre`), qui peut différer de la période affichée. */
  debut: string;
  fin: string;
  /** Sa période n'est pas celle affichée (une enveloppe, un budget par jour vu sur une semaine) : à préciser à l'écran. */
  autrePeriode: boolean;
  /** Nombre de ses périodes additionnées dans la période affichée (7 pour un budget par jour vu sur une semaine), 1 sinon. */
  nb: number;
  /** Restes reportés sur sa période : reçus (positif) moins partis (négatif), déjà dans `plafond`. */
  reporte: number;
};
export type Bilan = {
  debut: string;
  fin: string;
  depenses: Depense[];
  lignes: Ligne[];
  horsBudget: number;
  total: number;
  /**
   * Ce qui compte face au plafond, chaque budget sur sa propre période : tout, avec un budget « toutes les dépenses » ;
   * sinon les seules dépenses rangées dans un budget (une dépense hors budget ne mange pas le budget des courses).
   */
  compte: number;
  /** Plafond global : le budget « toutes les dépenses » s'il existe, sinon la somme des budgets. */
  plafondTotal: number;
  enCours: boolean;
};

/** Du plus court au plus long : un budget n'apparaît que dans les vues de sa durée ou plus longues. */
const RANG: Record<Periode, number> = { jour: 0, semaine: 1, mois: 2, trimestre: 3, annee: 4 };

/**
 * Les dépenses et les budgets d'une période affichée (`vue` qui contient `ref`), selon la périodicité de chaque budget :
 * - un budget de la même durée que la vue se compte sur cette période ;
 * - un budget plus court s'additionne sur la période : un budget par jour vu sur la semaine compte ses 7 jours,
 *   un budget à la semaine vu sur le mois compte les semaines qui commencent dans le mois (chacune en entier) ;
 * - un budget plus long n'y est pas : le budget du mois n'entre pas dans la vue Semaine.
 * Une enveloppe se compte sur toute sa durée dans chaque vue qui la touche. Rien n'est réparti ni supposé :
 * chaque montant est celui fixé, face aux dépenses notées dedans.
 */
export function bilan(f: Finances, vue: Periode, ref: string, aujourdhui: string): Bilan {
  const { debut, fin } = bornes(vue, ref);
  const dep = depensesEntre(f, debut, fin).sort((a, b) => b.date.localeCompare(a.date) || b.creeLe.localeCompare(a.creeLe));
  const total = somme(dep);
  const enCours = aujourdhui >= debut && aujourdhui <= fin;
  const r0 = enCours ? aujourdhui : aujourdhui < debut ? debut : fin;
  const lignes: Ligne[] = [];
  const ajouter = (b: Budget, fenetres: { debut: string; fin: string }[]) => {
    if (!fenetres.length) return;
    const p = arrondi(fenetres.reduce((s, w) => s + plafondFenetre(f, b, w.debut, w.fin), 0));
    const d = arrondi(fenetres.reduce((s, w) => s + depenseBudget(f, b, w.debut, w.fin), 0));
    const w = { debut: fenetres[0].debut, fin: fenetres[fenetres.length - 1].fin };
    const reporte = arrondi(fenetres.reduce((s, x) => s + ajustementReports(f, b.id, x.debut, x.fin), 0));
    lignes.push({ budget: b, plafond: p, depense: d, reste: arrondi(p - d), ratio: p ? d / p : d ? 1.01 : 0, ...w, autrePeriode: w.debut !== debut || w.fin !== fin, nb: fenetres.length, reporte });
  };
  for (const b of f.budgets) {
    if (b.enveloppe || b.periode === vue) {
      // Le jour de référence ramené dans les dates du budget, s'il touche la période affichée.
      const r = b.debut && b.debut > r0 ? b.debut : b.fin && b.fin < r0 ? b.fin : r0;
      const w = r >= debut && r <= fin ? fenetre(b, r) : null;
      if (w) ajouter(b, [w]);
    } else if (RANG[b.periode] < RANG[vue]) {
      // Chacune de ses périodes qui commence dans la vue, bornée par les dates du budget.
      const fenetres: { debut: string; fin: string }[] = [];
      let x = bornes(b.periode, debut).debut;
      if (x < debut) x = decaler(b.periode, x, 1);
      for (let i = 0; x <= fin && i < 400; i++, x = decaler(b.periode, x, 1)) {
        const pf = bornes(b.periode, x);
        const a = b.debut && b.debut > pf.debut ? b.debut : pf.debut;
        const z = b.fin && b.fin < pf.fin ? b.fin : pf.fin;
        if (a <= z) fenetres.push({ debut: a, fin: z });
      }
      ajouter(b, fenetres);
    }
  }
  const global = lignes.find((l) => l.budget.global);
  // Une enveloppe qui déborde de la période affichée reste dans la liste, mais pas dans les totaux de la période.
  const autres = lignes.filter((l) => !l.budget.global && (!l.budget.enveloppe || (l.debut >= debut && l.fin <= fin)));
  const plafondTotal = global ? global.plafond : arrondi(autres.reduce((s, l) => s + l.plafond, 0));
  const horsBudget = somme(dep.filter((x) => !idBudgetDe(f.budgets, x)));
  const compte = global ? global.depense : arrondi(autres.reduce((s, l) => s + l.depense, 0));
  return { debut, fin, depenses: dep, lignes, horsBudget, total, compte, plafondTotal, enCours };
}

/** Pour l'alerte après une dépense : part de son budget déjà utilisée sur la période propre à ce budget. */
export function usageBudget(f: Finances, b: Budget, d: string) {
  const s = suiviBudget(f, b, d);
  return s && s.total > 0 ? s.depense / s.total : 0;
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
