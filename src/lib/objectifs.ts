import { idBudgetDe } from './categories';
import { addDays, parse, ymd } from './dates';
import { depensesEntre, echeance as echeanceDe, revenusEntre } from './finances';
import type { Budget, Depense, Finances, Objectif, Versement } from './types';

/**
 * Objectifs d'argent et plan pour les atteindre.
 *
 * Un objectif a une somme à atteindre (ou à rembourser), une échéance et des versements. Le plan en tire :
 * combien verser à chaque échéance (chaque semaine ou chaque mois) pour tenir la date, où l'on en est par rapport
 * à une avance régulière, quand la somme sera atteinte au rythme choisi et au rythme réel, ce que le budget du
 * mois permet de mettre de côté, et, s'il manque de l'argent, où le trouver (réduire des budgets, reculer la date).
 *
 * Les montants sont dans la devise principale. Un versement n'est ni une dépense ni un revenu : il ne change
 * ni les budgets ni les prévisions. Dates en texte « AAAA-MM-JJ ».
 *
 * Ce fichier n'importe que des fichiers purs : il se teste avec `npm test`.
 */

const arrondi = (n: number) => Math.round(n * 100) / 100;
const hautCent = (n: number) => Math.ceil(n * 100 - 1e-9) / 100;
const ecart = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
const entre = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const SEMAINES_PAR_MOIS = 52 / 12;
/** Combien de mois d'historique on regarde pour mesurer ce qu'on peut mettre de côté. */
const MOIS_REGARDES = 3;

export const CADENCES: { key: 'mois' | 'semaine'; label: string; par: string }[] = [
  { key: 'mois', label: 'Chaque mois', par: 'par mois' },
  { key: 'semaine', label: 'Chaque semaine', par: 'par semaine' },
];
export const EMOJIS_OBJECTIF = ['🎯', '🛟', '✈️', '🏠', '🚗', '🎓', '💍', '👶', '💻', '📱', '🎁', '💳', '🏖️', '🛍️', '🌱', '🏥'];

/** Départs proposés ; le nom et le genre suffisent, le reste se règle ensuite. */
export const OBJECTIFS_SUGGERES: { nom: string; emoji: string; genre: Objectif['genre'] }[] = [
  { nom: "Fonds d'urgence", emoji: '🛟', genre: 'epargne' },
  { nom: 'Voyage', emoji: '✈️', genre: 'epargne' },
  { nom: 'Achat important', emoji: '🛍️', genre: 'epargne' },
  { nom: 'Rembourser une dette', emoji: '💳', genre: 'dette' },
];

/* ---------- Plan de versements ---------- */

const frequenceDe = (o: Pick<Objectif, 'plan'>) => (o.plan?.cadence === 'semaine' ? 'semaine' : 'mois');

/** n-ième date de versement prévue, à partir du début (même jour du mois, ou même jour de la semaine). */
export const dateVersement = (o: Pick<Objectif, 'debut' | 'plan'>, n: number) => echeanceDe({ debut: o.debut, frequence: frequenceDe(o) }, n);

/** Les dates de versement du plan, de la première période après le début jusqu'à l'échéance. Si l'échéance est plus proche, un seul versement : l'échéance. */
export function datesVersements(o: Pick<Objectif, 'debut' | 'echeance' | 'plan'>): string[] {
  const l: string[] = [];
  for (let n = 1; n <= 1500; n++) {
    const x = dateVersement(o, n);
    if (x > o.echeance) break;
    l.push(x);
  }
  return l.length ? l : [o.echeance];
}

/** Premier numéro de versement dont la date n'est pas passée. */
function premierNumero(o: Pick<Objectif, 'debut' | 'plan'>, d: string) {
  for (let n = 1; n <= 5000; n++) if (dateVersement(o, n) >= d) return n;
  return 5000;
}

export const totalVerse = (o: Pick<Objectif, 'versements'>) => arrondi(o.versements.reduce((s, v) => s + v.montant, 0));
export const acquisDe = (o: Pick<Objectif, 'versements' | 'depart'>) => arrondi((o.depart || 0) + totalVerse(o));
const parMois = (montant: number, cadence: 'mois' | 'semaine') => arrondi(cadence === 'mois' ? montant : montant * SEMAINES_PAR_MOIS);

export type EtatObjectif = 'atteint' | 'a_venir' | 'en_avance' | 'dans_les_temps' | 'en_retard' | 'depasse';
export const ETATS_OBJECTIF: Record<EtatObjectif, string> = {
  atteint: 'Atteint',
  a_venir: 'À venir',
  en_avance: 'En avance',
  dans_les_temps: 'Dans les temps',
  en_retard: 'En retard',
  depasse: 'Échéance passée',
};

export type SuiviObjectif = {
  /** Somme des versements (sans le point de départ). */
  verse: number;
  /** Départ plus versements. */
  acquis: number;
  reste: number;
  /** Part atteinte, de 0 à 1. */
  pct: number;
  atteint: boolean;
  /** Durée du plan, jours écoulés et jours restants jusqu'à l'échéance. */
  jours: number;
  ecoules: number;
  joursRestants: number;
  /** Ce qu'une avance régulière aurait déjà donné aujourd'hui, et l'écart (positif = en avance). */
  attendu: number;
  ecart: number;
  etat: EtatObjectif;
  cadence: 'mois' | 'semaine';
  /** Versements qu'il reste à faire jusqu'à l'échéance (au moins un si le reste n'est pas nul). */
  versementsRestants: number;
  /** Montant par versement qui tient l'échéance. */
  requis: number;
  /** Montant par versement du plan : celui choisi, sinon `requis`. */
  versement: number;
  /** Le montant vient du choix de l'utilisateur (sinon il est calculé). */
  choisi: boolean;
  /** Le même montant ramené à un mois, pour le comparer à ce qu'on peut mettre de côté. */
  requisMensuel: number;
  versementMensuel: number;
  prochain: string | null;
  /** Quand la somme sera atteinte en versant `versement` aux dates du plan (null s'il n'y a rien à verser). */
  dateAtteinte: string | null;
  /** Jours de retard sur l'échéance à ce rythme (0 s'il tient, négatif = en avance). */
  ecartEcheance: number | null;
  /** Ce qui a vraiment été versé par mois ces 90 derniers jours, et la date que cela donne. */
  rythmeReel: number;
  dateAtteinteReelle: string | null;
};

export function suiviObjectif(o: Objectif, d: string): SuiviObjectif {
  const verse = totalVerse(o);
  const acquis = acquisDe(o);
  const cible = Math.max(0, o.cible);
  const reste = arrondi(Math.max(0, cible - acquis));
  const atteint = cible > 0 && acquis >= cible;
  const jours = Math.max(1, ecart(o.debut, o.echeance));
  const ecoules = entre(ecart(o.debut, d), 0, jours);
  const base = Math.min(o.depart || 0, cible);
  const attendu = arrondi(base + ((cible - base) * ecoules) / jours);
  const diff = arrondi(acquis - attendu);
  const tolerance = cible * 0.03;
  const etat: EtatObjectif = atteint ? 'atteint' : o.debut > d ? 'a_venir' : o.echeance < d ? 'depasse' : diff > tolerance ? 'en_avance' : diff >= -tolerance ? 'dans_les_temps' : 'en_retard';

  const cadence = frequenceDe(o);
  const n0 = premierNumero(o, d);
  const dates = datesVersements(o).filter((x) => x >= d);
  const versementsRestants = reste > 0 ? Math.max(1, dates.length) : 0;
  const requis = reste > 0 ? hautCent(reste / versementsRestants) : 0;
  const choisi = !!o.plan?.versement && o.plan.versement > 0;
  const versement = choisi ? o.plan!.versement! : requis;

  let dateAtteinte: string | null = null;
  if (atteint) dateAtteinte = null;
  else if (versement > 0) {
    const k = Math.min(5000, Math.ceil(reste / versement - 1e-9));
    dateAtteinte = dateVersement(o, n0 + k - 1);
  }
  const ecartEcheance = dateAtteinte ? ecart(o.echeance, dateAtteinte) : null;

  const depuis = addDays(d, -89);
  const recent = o.versements.filter((v) => v.date >= depuis && v.date <= d).reduce((s, v) => s + v.montant, 0);
  const rythmeReel = arrondi(recent / 3);
  const dateAtteinteReelle = !atteint && rythmeReel > 0 ? addDays(d, Math.min(36500, Math.ceil((reste / rythmeReel) * (365.25 / 12)))) : null;

  return {
    verse,
    acquis,
    reste,
    pct: cible > 0 ? entre(acquis / cible, 0, 1) : 0,
    atteint,
    jours,
    ecoules,
    joursRestants: Math.max(0, ecart(d, o.echeance)),
    attendu,
    ecart: diff,
    etat,
    cadence,
    versementsRestants,
    requis,
    versement,
    choisi,
    requisMensuel: parMois(requis, cadence),
    versementMensuel: parMois(versement, cadence),
    prochain: reste > 0 ? (dates[0] ?? dateVersement(o, n0)) : null,
    dateAtteinte,
    ecartEcheance,
    rythmeReel,
    dateAtteinteReelle,
  };
}

/* ---------- Étapes ---------- */

export type EtapeObjectif = { pct: number; montant: number; date: string; etat: 'fait' | 'en_retard' | 'a_venir'; faitLe?: string };

/** Quatre étapes (25, 50, 75 et 100 %) réparties régulièrement entre le départ et l'échéance. */
export function etapesObjectif(o: Objectif, d: string): EtapeObjectif[] {
  const jours = Math.max(1, ecart(o.debut, o.echeance));
  const cible = Math.max(0, o.cible);
  const base = Math.min(o.depart || 0, cible);
  const acquis = acquisDe(o);
  const tries = [...o.versements].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return [0.25, 0.5, 0.75, 1].map((p) => {
    const montant = arrondi(base + (cible - base) * p);
    const date = addDays(o.debut, Math.round(jours * p));
    if (acquis < montant) return { pct: p, montant, date, etat: date < d ? ('en_retard' as const) : ('a_venir' as const) };
    // Atteinte : le jour du versement qui a franchi la barre (ou aucun jour si le départ la dépassait déjà).
    let cumul = o.depart || 0;
    let faitLe: string | undefined;
    if (cumul < montant) for (const v of tries) if ((cumul += v.montant) >= montant) return { pct: p, montant, date, etat: 'fait' as const, faitLe: v.date };
    return { pct: p, montant, date, etat: 'fait' as const, faitLe };
  });
}

/* ---------- Ce qu'on peut mettre de côté ---------- */

export type Capacite = {
  /** Moyenne mensuelle de « revenus moins dépenses » sur les derniers mois complets. */
  parMois: number;
  revenus: number;
  depenses: number;
  /** Nombre de mois pris en compte (au plus 3). */
  mois: number;
};

const debutMois = (d: string, n: number) => ymd(new Date(parse(d).getFullYear(), parse(d).getMonth() + n, 1));
const finMois = (d: string, n: number) => ymd(new Date(parse(d).getFullYear(), parse(d).getMonth() + n + 1, 0));

/** Les dépenses courantes : `depensesEntre` laisse déjà de côté les versements vers un objectif (de l'épargne, pas de la consommation). */
const depensesCourantes = depensesEntre;

/** Les derniers mois complets (le mois en cours n'est pas fini) qui ont au moins une opération. */
function moisComptes(f: Finances, d: string) {
  const l: { debut: string; fin: string; revenus: number; depenses: number }[] = [];
  for (let n = -1; n >= -MOIS_REGARDES; n--) {
    const debut = debutMois(d, n);
    const fin = finMois(d, n);
    const revenus = revenusEntre(f, debut, fin).reduce((s, x) => s + x.montant, 0);
    const depenses = depensesCourantes(f, debut, fin).reduce((s, x) => s + x.montant, 0);
    if (revenus > 0 || depenses > 0) l.push({ debut, fin, revenus, depenses });
  }
  return l;
}

/** Combien il reste chaque mois une fois les dépenses payées, en moyenne ; null sans historique. */
export function capaciteMensuelle(f: Finances, d: string): Capacite | null {
  const l = moisComptes(f, d);
  if (!l.length) return null;
  const revenus = l.reduce((s, m) => s + m.revenus, 0) / l.length;
  const depenses = l.reduce((s, m) => s + m.depenses, 0) / l.length;
  return { parMois: arrondi(revenus - depenses), revenus: arrondi(revenus), depenses: arrondi(depenses), mois: l.length };
}

export const objectifsActifs = (f: Finances) => (f.objectifs ?? []).filter((o) => !o.archive);

export type Faisabilite = {
  capacite: Capacite | null;
  /** Ce que demandent les autres objectifs en cours chaque mois. */
  autres: number;
  /** Ce qui reste à mettre de côté chaque mois une fois les autres objectifs servis. */
  libre: number | null;
  /** Ce que demande le plan de cet objectif chaque mois. */
  besoin: number;
  manque: number;
  /** Faux sans historique de revenus : on ne peut pas conclure. */
  tient: boolean | null;
};

/** Le plan de cet objectif tient-il dans ce que le budget laisse chaque mois, une fois les autres objectifs en cours servis ? */
export function faisabilite(f: Finances, o: Objectif, d: string): Faisabilite {
  const capacite = capaciteMensuelle(f, d);
  const autres = arrondi(objectifsActifs(f).filter((x) => x.id !== o.id).reduce((s, x) => s + (suiviObjectif(x, d).atteint ? 0 : suiviObjectif(x, d).versementMensuel), 0));
  const besoin = suiviObjectif(o, d).versementMensuel;
  // Sans revenu noté, « revenus moins dépenses » serait une valeur négative qui ne dit rien : on ne conclut pas.
  if (!capacite || capacite.revenus <= 0) return { capacite, autres, libre: null, besoin, manque: 0, tient: null };
  const libre = arrondi(capacite.parMois - autres);
  const manque = arrondi(Math.max(0, besoin - Math.max(0, libre)));
  return { capacite, autres, libre, besoin, manque, tient: manque === 0 };
}

/* ---------- Où trouver l'argent ---------- */

export type Levier = { budget: string; nom: string; emoji: string; /** Dépense mensuelle moyenne de ce budget. */ moyenne: number; economie: number };
export type PlanReduction = { pct: number; leviers: Levier[]; total: number; couvre: boolean };

/** Dépense moyenne par mois de chaque budget (hors budget total), sur les derniers mois complets. */
export function depenseMoyenneParBudget(f: Finances, d: string): { budget: Budget; moyenne: number }[] {
  const l = moisComptes(f, d);
  if (!l.length) return [];
  const somme = new Map<string, number>();
  for (const m of l)
    for (const x of depensesCourantes(f, m.debut, m.fin)) {
      const id = idBudgetDe(f.budgets, x);
      if (id) somme.set(id, (somme.get(id) || 0) + x.montant);
    }
  return f.budgets
    .filter((b) => !b.global && somme.has(b.id))
    .map((budget) => ({ budget, moyenne: arrondi(somme.get(budget.id)! / l.length) }))
    .filter((x) => x.moyenne > 0)
    .sort((a, b) => b.moyenne - a.moyenne);
}

/**
 * Combien réduire les plus gros budgets pour trouver `manque` par mois : le plus petit pourcentage (10, 20 ou 30 %)
 * appliqué aux trois plus gros postes qui suffit. S'il ne suffit pas, 30 % et `couvre` faux.
 */
export function planReduction(f: Finances, d: string, manque: number): PlanReduction | null {
  if (manque <= 0) return null;
  const gros = depenseMoyenneParBudget(f, d).slice(0, 3);
  if (!gros.length) return null;
  let dernier: PlanReduction | null = null;
  for (const pct of [10, 20, 30]) {
    const leviers = gros.map(({ budget, moyenne }) => ({ budget: budget.id, nom: budget.nom, emoji: budget.emoji, moyenne, economie: arrondi((moyenne * pct) / 100) }));
    const total = arrondi(leviers.reduce((s, x) => s + x.economie, 0));
    dernier = { pct, leviers, total, couvre: total >= manque };
    if (dernier.couvre) return dernier;
  }
  return dernier;
}

/** Date atteignable en ne versant que ce qui est libre chaque mois ; null si rien n'est libre. */
export function echeanceTenable(o: Objectif, d: string, libre: number | null): string | null {
  const s = suiviObjectif(o, d);
  if (s.atteint || !libre || libre <= 0) return null;
  const mois = Math.ceil(s.reste / libre - 1e-9);
  const x = parse(d);
  return ymd(new Date(x.getFullYear(), x.getMonth() + mois, x.getDate()));
}

/** Un fonds d'urgence classique : trois mois de dépenses. Null sans historique. */
export function fondsUrgenceConseille(f: Finances, d: string): number | null {
  const c = capaciteMensuelle(f, d);
  return c && c.depenses > 0 ? Math.round((c.depenses * 3) / 10) * 10 : null;
}

/* ---------- Création et versements ---------- */

export type BrouillonObjectif = { nom: string; emoji: string; genre: Objectif['genre']; cible: number; depart?: number; echeance: string; debut?: string; plan?: Objectif['plan']; categories?: string[]; note?: string };

/** Le message à montrer si l'objectif n'est pas valide, sinon null. */
export function erreurObjectif(b: Pick<BrouillonObjectif, 'nom' | 'cible' | 'depart' | 'echeance'> & { debut?: string }, aujourdhui: string): string | null {
  if (!b.nom.trim()) return 'Donne un nom à cet objectif.';
  if (!(b.cible > 0)) return 'La somme à atteindre doit être plus grande que zéro.';
  if ((b.depart || 0) < 0) return 'Ce qui est déjà de côté ne peut pas être négatif.';
  if ((b.depart || 0) >= b.cible) return 'Ce qui est déjà de côté atteint déjà la somme visée.';
  if (!b.echeance) return 'Choisis la date à laquelle tu veux y arriver.';
  if (b.echeance <= (b.debut || aujourdhui)) return 'La date doit être après le début.';
  return null;
}

export function creerObjectif(b: BrouillonObjectif, id: string, aujourdhui: string): Objectif {
  return {
    id,
    nom: b.nom.trim(),
    emoji: b.emoji,
    genre: b.genre,
    cible: arrondi(b.cible),
    ...(b.depart ? { depart: arrondi(b.depart) } : {}),
    debut: b.debut || aujourdhui,
    echeance: b.echeance,
    versements: [],
    ...(b.plan ? { plan: b.plan } : {}),
    ...(b.categories?.length ? { categories: b.categories } : {}),
    ...(b.note?.trim() ? { note: b.note.trim() } : {}),
    creeLe: new Date().toISOString(),
  };
}

export const ajouterVersement = (o: Objectif, v: Versement): Objectif => ({ ...o, versements: [v, ...o.versements] });
export const retirerVersement = (o: Objectif, id: string): Objectif => ({ ...o, versements: o.versements.filter((v) => v.id !== id) });

/** Un versement d'un montant donné est-il déjà noté ce jour-là ? Évite le double clic sur « Verser ». */
export const dejaVerse = (o: Objectif, date: string, montant: number) => o.versements.some((v) => v.date === date && Math.abs(v.montant - montant) < 0.005);

/* ---------- Vue d'ensemble ---------- */

export type ResumeObjectifs = { nb: number; atteints: number; enRetard: number; cible: number; acquis: number; pct: number; /** Ce que demandent tous les plans en cours chaque mois. */ parMois: number };

export function resumeObjectifs(f: Finances, d: string): ResumeObjectifs {
  const l = objectifsActifs(f);
  let atteints = 0;
  let enRetard = 0;
  let cible = 0;
  let acquis = 0;
  let mensuel = 0;
  for (const o of l) {
    const s = suiviObjectif(o, d);
    cible += o.cible;
    acquis += Math.min(s.acquis, o.cible);
    if (s.atteint) atteints++;
    else {
      mensuel += s.versementMensuel;
      if (s.etat === 'en_retard' || s.etat === 'depasse') enRetard++;
    }
  }
  return { nb: l.length, atteints, enRetard, cible: arrondi(cible), acquis: arrondi(acquis), pct: cible > 0 ? entre(acquis / cible, 0, 1) : 0, parMois: arrondi(mensuel) };
}

/* ---------- Dépenses reliées ---------- */

/**
 * Les dépenses rangées dans une catégorie de l'objectif depuis son début, les plus récentes d'abord : `aCompter` n'a pas
 * encore été notée comme versement, `comptees` l'a été. Sans catégorie sur l'objectif, rien n'est relié.
 */
export function depensesLiees(f: Finances, o: Objectif): { aCompter: Depense[]; comptees: Depense[] } {
  const cats = o.categories ?? [];
  if (!cats.length) return { aCompter: [], comptees: [] };
  const deja = new Set(o.versements.map((v) => v.depense).filter(Boolean));
  const l = f.depenses.filter((x) => !x.lien && x.date >= o.debut && (x.categories ?? []).some((c) => cats.includes(c))).sort((a, b) => b.date.localeCompare(a.date) || b.creeLe.localeCompare(a.creeLe));
  return { aCompter: l.filter((x) => !deja.has(x.id)), comptees: l.filter((x) => deja.has(x.id)) };
}

/** Note une dépense comme versement. L'identifiant dépend de la dépense : deux appareils qui la comptent ne la doublent pas. */
export function compterDepense(o: Objectif, x: Pick<Depense, 'id' | 'date' | 'montant' | 'note'>): Objectif {
  if (o.versements.some((v) => v.depense === x.id)) return o;
  return ajouterVersement(o, { id: `dep:${x.id}`, date: x.date, montant: x.montant, depense: x.id, ...(x.note ? { note: x.note } : {}) });
}
