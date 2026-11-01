import { addDays } from './dates';
import { bilan, bornes, decaler, fmtMontant, libelle, reportsValides, suiviBudget } from './finances';
import { ajouterVersement } from './objectifs';
import type { Budget, CaseBudget, Finances, Objectif, Periode, Report } from './types';

/**
 * Le reste non dépensé d'un budget, à disposer : le reporter sur le budget d'une autre période (un autre jour,
 * une semaine, un mois) ou le verser sur un objectif. Rien ne se fait tout seul : c'est l'utilisateur qui choisit.
 *
 * Un report baisse le plafond de la période de départ et monte celui de la période d'arrivée du même montant
 * (voir `ajustementReports` dans finances.ts) : le reste de départ tombe à zéro, rien n'est compté deux fois.
 * Vers un objectif, il devient un versement qui porte son identifiant ; supprimer ce versement annule le report.
 *
 * Ce fichier n'importe que des fichiers purs : il se teste avec `npm test`.
 */

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** La case d'un budget sur la période qui contient `date`. */
export const caseDe = (budget: string, periode: Periode, date: string): CaseBudget => ({ budget, periode, debut: bornes(periode, date).debut });
/** Le budget court-il au moins un jour de cette case ? Un reste reporté sur un budget terminé (ou pas commencé) serait perdu. */
export const courtSur = (b: Pick<Budget, 'debut' | 'fin'>, c: CaseBudget) => !(b.fin && b.fin < c.debut) && !(b.debut && b.debut > bornes(c.periode, c.debut).fin);
const chevauche = (a: CaseBudget, b: CaseBudget) => a.budget === b.budget && a.debut <= bornes(b.periode, b.debut).fin && b.debut <= bornes(a.periode, a.debut).fin;

/** `case` : la période du budget d'où part le reste (son mois pour un budget au mois), pas forcément celle affichée. */
export type Reportable = { budget: Budget; reste: number; plafond: number; depense: number; case: CaseBudget };

/**
 * Les budgets de la période affichée qui ont un reste à reporter, le budget total en tête. Chacun sur sa propre
 * période (voir `bilan`) : le reste d'un budget au mois est celui de son mois. Une période à venir n'a rien à
 * reporter : on ne sait pas encore ce qui y sera dépensé.
 */
export function restesReportables(f: Finances, periode: Periode, ref: string, aujourdhui: string): Reportable[] {
  const b = bilan(f, periode, ref, aujourdhui);
  if (b.debut > aujourdhui) return [];
  return b.lignes
    // Un budget additionné sur plusieurs de ses périodes (par jour vu sur la semaine) se reporte depuis sa propre vue.
    .filter((l) => l.reste >= 0.01 && l.plafond > 0 && l.debut <= aujourdhui && l.nb === 1)
    .sort((x, y) => Number(!!y.budget.global) - Number(!!x.budget.global) || y.reste - x.reste)
    .map((l) => ({ budget: l.budget, reste: arrondi(l.reste), plafond: l.plafond, depense: l.depense, case: { budget: l.budget.id, periode: l.budget.periode, debut: l.debut } }));
}

/** Où l'on peut envoyer un reste : la même durée juste après, puis les durées plus longues qui suivent. */
export function arriveesProposees(de: CaseBudget): { cle: string; label: string; case: CaseBudget }[] {
  // La première période de cette durée qui commence après la fin de celle de départ (une semaine à cheval n'est pas « suivante »).
  const apres = addDays(bornes(de.periode, de.debut).fin, 1);
  const suivant = (p: Periode, label: string) => {
    const b = bornes(p, apres).debut;
    const debut = b < apres ? decaler(p, b, 1) : b;
    return { cle: `${p}:${debut}`, label, case: { budget: de.budget, periode: p, debut } };
  };
  const l = [suivant('jour', 'Le jour suivant'), suivant('semaine', 'La semaine suivante'), suivant('mois', 'Le mois suivant')];
  return l;
}

export type Arrivee = { case: CaseBudget } | { objectif: string };

/** Le message à montrer si le report ne peut pas se faire, sinon null. */
export function erreurReport(f: Finances, de: CaseBudget, montant: number | null, vers: Arrivee | null, aujourdhui: string): string | null {
  const dispo = restesReportables(f, de.periode, de.debut, aujourdhui).find((x) => x.budget.id === de.budget)?.reste ?? 0;
  if (!dispo) return 'Il ne reste rien à reporter sur cette période.';
  if (!montant || montant <= 0) return 'Indique le montant à reporter.';
  if (montant > dispo + 0.004) return `Il ne reste que ${fmtMontant(dispo, f.devise)} sur cette période.`;
  if (!vers) return 'Choisis où mettre ce reste.';
  if ('case' in vers) {
    // Une arrivée qui contient le départ (la semaine du jour d'où vient le reste) le lui rendrait en partie.
    if (chevauche(vers.case, de)) return 'Choisis une période qui ne contient pas celle d’où vient le reste.';
    const b = f.budgets.find((x) => x.id === vers.case.budget);
    if (!b) return 'Ce budget n’existe plus.';
    if (!courtSur(b, vers.case)) return `${b.nom} ne court plus sur cette période : choisis un autre budget, ou verse ce reste sur un objectif.`;
  } else if (!(f.objectifs ?? []).some((o) => o.id === vers.objectif && !o.archive)) return 'Cet objectif n’existe plus.';
  return null;
}

/** Une période en milieu de phrase : « mardi 28 octobre 2026 », « du 2 au 8 novembre », « novembre 2026 ». */
export const libelleMinuscule = (p: Periode, d: string) => {
  const t = libelle(p, d);
  return t[0].toLowerCase() + t.slice(1);
};

/** Comment dire une case : « Courses, mardi 28 octobre 2026 ». */
export function libelleCase(f: Finances, c: CaseBudget) {
  const b = f.budgets.find((x) => x.id === c.budget);
  return `${b ? `${b.emoji} ${b.nom}, ` : ''}${libelleMinuscule(c.periode, c.debut)}`;
}

const nomBudget = (f: Finances, id: string) => {
  const b = f.budgets.find((x) => x.id === id);
  return b ? `${b.emoji} ${b.nom}` : 'un budget supprimé';
};

/** Reporte `montant` du reste de `de` vers une autre période ou un objectif. */
export function reporter(f: Finances, de: CaseBudget, montant: number, vers: Arrivee, id: string, aujourdhui: string): Finances {
  const m = arrondi(montant);
  const r: Report = { id, montant: m, de, vers: 'case' in vers ? vers.case : { objectif: vers.objectif }, creeLe: new Date().toISOString() };
  const reports = [r, ...(f.reports ?? [])];
  if ('case' in vers) return { ...f, reports };
  const note = `Reste du budget : ${libelleCase(f, de)}`;
  // L'identifiant du versement dépend du report : deux appareils qui le rejouent ne le doublent pas.
  const verse = (o: Objectif) => (o.versements.some((v) => v.report === id) ? o : ajouterVersement(o, { id: `rep:${id}`, date: aujourdhui, montant: m, note, report: id }));
  return { ...f, reports, objectifs: (f.objectifs ?? []).map((o) => (o.id === vers.objectif ? verse(o) : o)) };
}

/** Annule un report : le reste revient à sa période de départ, le versement éventuel disparaît. */
export function annulerReport(f: Finances, id: string): Finances {
  return {
    ...f,
    reports: (f.reports ?? []).filter((r) => r.id !== id),
    objectifs: f.objectifs?.map((o) => (o.versements.some((v) => v.report === id) ? { ...o, versements: o.versements.filter((v) => v.report !== id) } : o)),
  };
}

export type LigneReport = { report: Report; sens: 'parti' | 'recu' | 'transfert'; titre: string; detail: string };

/** Les reports partis de la période `debut`–`fin` ou arrivés dessus, du plus récent au plus ancien. */
export function reportsDeLaPeriode(f: Finances, debut: string, fin: string): LigneReport[] {
  const dans = (c: CaseBudget) => c.debut <= fin && bornes(c.periode, c.debut).fin >= debut;
  // Un transfert ne se montre que dans les vues qui contiennent toute la période du côté concerné : pris sur le mois
  // de Courses, il ne se voit pas comme « parti » depuis un jour où le budget du mois n'est pas affiché.
  const contenu = (c: CaseBudget) => c.debut >= debut && bornes(c.periode, c.debut).fin <= fin;
  const out: LigneReport[] = [];
  for (const r of [...reportsValides(f)].sort((a, b) => b.creeLe.localeCompare(a.creeLe))) {
    const vers = 'objectif' in r.vers ? (f.objectifs ?? []).find((o) => o.id === (r.vers as { objectif: string }).objectif) : null;
    const arrivee = 'objectif' in r.vers ? (vers ? `${vers.emoji} objectif ${vers.nom}` : 'un objectif') : libelleCase(f, r.vers);
    // Un transfert d'un budget à l'autre dont les deux côtés sont dans la période : une seule ligne.
    if (estTransfert(r)) {
      const vc = r.vers as CaseBudget;
      if (contenu(r.de) && contenu(vc)) out.push({ report: r, sens: 'transfert', titre: `${fmtMontant(r.montant, f.devise)} de ${nomBudget(f, r.de.budget)} vers ${nomBudget(f, vc.budget)}`, detail: `Pris sur ${libelleCase(f, r.de)}, pour ${libelleCase(f, vc)}` });
      else if (contenu(r.de)) out.push({ report: r, sens: 'parti', titre: `${fmtMontant(r.montant, f.devise)} vers ${libelleCase(f, vc)}`, detail: `Pris sur ${libelleCase(f, r.de)}` });
      else if (contenu(vc)) out.push({ report: r, sens: 'recu', titre: `${fmtMontant(r.montant, f.devise)} reçus de ${libelleCase(f, r.de)}`, detail: `Sur ${libelleCase(f, vc)}` });
    } else if (dans(r.de)) out.push({ report: r, sens: 'parti', titre: `${fmtMontant(r.montant, f.devise)} vers ${arrivee}`, detail: `Reste de ${libelleCase(f, r.de)}` });
    else if (!('objectif' in r.vers) && dans(r.vers)) out.push({ report: r, sens: 'recu', titre: `${fmtMontant(r.montant, f.devise)} reçus de ${libelleCase(f, r.de)}`, detail: `Sur ${libelleCase(f, r.vers)}` });
  }
  return out;
}

/* ---------- Transfert entre budgets ---------- */

/**
 * Un budget dépassé peut être comblé avec l'argent d'un autre budget qui a encore de la marge : c'est un report
 * d'un budget à l'autre, sur la même période (le reste de Courses en octobre vers le budget Repas de mardi).
 * Le plafond de la source baisse, celui du budget dépassé monte du même montant ; rien n'est compté deux fois et
 * le serveur fait le même calcul (me-api, `mouvementsReports`). Il s'annule comme un report.
 */

/** Un budget sur sa période qui contient `date`, comme case de report (son mois pour un budget au mois). */
function caseSuivie(f: Finances, budget: Budget, date: string) {
  const s = suiviBudget(f, budget, date);
  return s ? { suivi: s, case: { budget: budget.id, periode: budget.periode, debut: s.debut } as CaseBudget } : null;
}

export type Depassement = { budget: Budget; depasse: number; plafond: number; depense: number; case: CaseBudget };

/**
 * Les budgets dépassés de la période affichée, le plus dépassé en tête. Pas le budget global (il compte toutes les
 * dépenses, on ne le comble pas avec un autre budget) ni un budget additionné sur plusieurs de ses périodes
 * (un budget par jour vu sur la semaine) : on le comble depuis le jour en question. Pas de période à venir.
 */
export function budgetsDepasses(f: Finances, periode: Periode, ref: string, aujourdhui: string): Depassement[] {
  const b = bilan(f, periode, ref, aujourdhui);
  return b.lignes
    .filter((l) => l.reste <= -0.01 && !l.budget.global && l.nb === 1 && l.debut <= aujourdhui)
    .sort((x, y) => x.reste - y.reste)
    .map((l) => ({ budget: l.budget, depasse: arrondi(-l.reste), plafond: l.plafond, depense: l.depense, case: { budget: l.budget.id, periode: l.budget.periode, debut: l.debut } }));
}

const RANG: Record<Periode, number> = { jour: 0, semaine: 1, mois: 2, trimestre: 3, annee: 4 };

/**
 * Les budgets d'où l'on peut prendre de l'argent pour combler `vers` : les autres budgets (hors global) qui courent
 * le premier jour de sa période et y ont encore un reste, chacun sur sa propre période (un budget au mois donne sur
 * son mois). Un budget plus court n'en fait pas partie (le budget d'un jour ne comble pas une semaine), sauf une
 * enveloppe. Le plus gros reste en tête.
 */
export function sourcesTransfert(f: Finances, vers: CaseBudget): Reportable[] {
  const cible = f.budgets.find((b) => b.id === vers.budget);
  if (!cible) return [];
  const out: Reportable[] = [];
  for (const b of f.budgets) {
    if (b.id === vers.budget || b.global) continue;
    if (!b.enveloppe && !cible.enveloppe && RANG[b.periode] < RANG[cible.periode]) continue;
    const c = caseSuivie(f, b, vers.debut);
    if (!c || c.suivi.reste < 0.01 || c.suivi.total <= 0) continue;
    out.push({ budget: b, reste: arrondi(c.suivi.reste), plafond: c.suivi.total, depense: c.suivi.depense, case: c.case });
  }
  return out.sort((x, y) => y.reste - x.reste);
}

/** Les budgets dépassés de la période affichée qu'un autre budget peut combler. */
export const depassementsComblables = (f: Finances, periode: Periode, ref: string, aujourdhui: string) => budgetsDepasses(f, periode, ref, aujourdhui).filter((x) => sourcesTransfert(f, x.case).length > 0);

/** Ce qui manque à un budget sur sa période (`vers`), 0 s'il n'est pas dépassé. */
export function manque(f: Finances, vers: CaseBudget) {
  const b = f.budgets.find((x) => x.id === vers.budget);
  const s = b ? suiviBudget(f, b, vers.debut) : null;
  return s && s.reste < 0 ? arrondi(-s.reste) : 0;
}

/** Le montant proposé : de quoi combler le dépassement, sans dépasser le reste de la source. */
export const montantPropose = (f: Finances, de: CaseBudget, vers: CaseBudget) => {
  const dispo = sourcesTransfert(f, vers).find((x) => x.budget.id === de.budget)?.reste ?? 0;
  return arrondi(Math.min(dispo, manque(f, vers)));
};

/** Le message à montrer si le transfert ne peut pas se faire, sinon null. */
export function erreurTransfert(f: Finances, de: CaseBudget | null, vers: CaseBudget, montant: number | null): string | null {
  if (!f.budgets.some((b) => b.id === vers.budget)) return 'Ce budget n’existe plus.';
  if (!de) return 'Choisis le budget d’où vient l’argent.';
  if (de.budget === vers.budget) return 'Choisis un autre budget que celui à combler.';
  const dispo = sourcesTransfert(f, vers).find((x) => x.budget.id === de.budget)?.reste ?? 0;
  if (!dispo) return 'Ce budget n’a plus rien à donner sur cette période.';
  if (!montant || montant <= 0) return 'Indique le montant à transférer.';
  if (montant > dispo + 0.004) return `Il ne reste que ${fmtMontant(dispo, f.devise)} sur ce budget.`;
  return null;
}

/** Transfère `montant` du budget `de` vers le budget `vers` : un report d'un budget à l'autre, annulable. */
export function transferer(f: Finances, de: CaseBudget, vers: CaseBudget, montant: number, id: string): Finances {
  const r: Report = { id, montant: arrondi(montant), de, vers, creeLe: new Date().toISOString() };
  return { ...f, reports: [r, ...(f.reports ?? [])] };
}

/** Un report d'un budget à un autre (un transfert), plutôt que d'une période à l'autre du même budget. */
export const estTransfert = (r: Report) => !('objectif' in r.vers) && r.vers.budget !== r.de.budget;
