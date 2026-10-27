import type { Compte, Depense, Finances, Revenu } from './types';

/**
 * Comptes bancaires et liens entre opérations.
 *
 * Un compte regroupe les opérations d'un relevé (« Equity – dollars », « M-Pesa », « Cash »). Un virement entre deux de mes comptes
 * apparaît deux fois, une sortie dans l'un et une entrée dans l'autre : on lie les deux moitiés (`lien`) pour qu'elles ne comptent
 * ni comme une dépense, ni comme un revenu. Aucune dépendance : se teste avec `npm test`.
 */

export const EMOJIS_COMPTE = ['🏦', '💳', '📱', '💵', '🪙', '💼', '🏠'];

export const comptesDe = (f: Finances): Compte[] => f.comptes || [];
export const compteDe = (f: Finances, id: string | null | undefined) => (id ? comptesDe(f).find((c) => c.id === id) : undefined);
export const libelleCompte = (c: Compte) => `${c.emoji} ${c.nom}`;
/** Nom à afficher pour l'identifiant d'un compte (absent, ou compte supprimé depuis). */
export const nomCompte = (f: Finances, id: string | null | undefined) => (id ? compteDe(f, id)?.nom ?? 'Compte supprimé' : 'Sans compte');
/** Moitié d'un virement entre deux comptes. */
export const estVirement = (x: { lien?: string | null }) => !!x.lien;

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Message d'erreur si le nom ne convient pas, sinon chaîne vide. Deux comptes ne portent pas le même nom : on ne saurait plus les distinguer. */
export function verifierNom(f: Finances, nom: string, sauf?: string) {
  const n = sansAccents(nom);
  if (!n) return 'Donne un nom au compte, par exemple « Equity – dollars ».';
  if (comptesDe(f).some((c) => c.id !== sauf && sansAccents(c.nom) === n)) return 'Un compte porte déjà ce nom. Ajoute la banque ou la devise pour les distinguer (« Equity – dollars », « Equity – francs »).';
  return '';
}

export const ajouterCompte = (f: Finances, c: Compte): Finances => ({ ...f, comptes: [...comptesDe(f), c] });

export const modifierCompte = (f: Finances, id: string, patch: Partial<Omit<Compte, 'id'>>): Finances => ({ ...f, comptes: comptesDe(f).map((c) => (c.id === id ? { ...c, ...patch } : c)) });

/** Retire le compte ; ses opérations restent, sans compte. */
export function supprimerCompte(f: Finances, id: string): Finances {
  const detache = <T extends { compte?: string }>(x: T): T => {
    if (x.compte !== id) return x;
    const { compte: _, ...reste } = x;
    return reste as T;
  };
  return { ...f, comptes: comptesDe(f).filter((c) => c.id !== id), depenses: f.depenses.map(detache), revenus: f.revenus?.map(detache) };
}

/** Nombre d'opérations pas encore rattachées à un compte. */
export const nbSansCompte = (f: Finances) => f.depenses.filter((x) => !x.compte).length + (f.revenus || []).filter((x) => !x.compte).length;

/** Rattache à un compte les opérations qui n'en ont pas encore (toutes, ou seulement celles dont on donne l'identifiant). */
export function rattacher(f: Finances, compte: string, ids?: string[]): Finances {
  const ok = (x: { id: string; compte?: string }) => !x.compte && (!ids || ids.includes(x.id));
  return { ...f, depenses: f.depenses.map((x) => (ok(x) ? { ...x, compte } : x)), revenus: f.revenus?.map((x) => (ok(x) ? { ...x, compte } : x)) };
}

/** Change le compte d'une opération (null : la détache). */
export function changerCompte(f: Finances, id: string, compte: string | null): Finances {
  const maj = <T extends { id: string; compte?: string }>(x: T): T => {
    if (x.id !== id) return x;
    if (compte) return { ...x, compte };
    const { compte: _, ...reste } = x;
    return reste as T;
  };
  return { ...f, depenses: f.depenses.map(maj), revenus: f.revenus?.map(maj) };
}

// ——— Liens entre opérations ———

/** Ce qu'il faut savoir d'une opération pour la rapprocher d'une autre. */
export type OpLiable = { id: string; sens: 'sortie' | 'entree'; date: string; montant: number; compte: string | null; lien: string | null; note?: string };

const ms = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const ecartJours = (a: string, b: string) => Math.abs(Math.round((ms(a) - ms(b)) / 864e5));
const ecartMontant = (a: number, b: number) => arrondi(Math.abs(a - b));

export const lienId = (sortie: string, entree: string) => `v-${sortie}-${entree}`;

/** Lie une sortie et une entrée : le virement d'un compte à l'autre. Null si l'une n'existe pas, est déjà liée, ou si les deux sont du même côté. */
export function lier(f: Finances, sortieId: string, entreeId: string): Finances | null {
  const s = f.depenses.find((x) => x.id === sortieId);
  const e = (f.revenus || []).find((x) => x.id === entreeId);
  if (!s || !e || s.lien || e.lien) return null;
  const lien = lienId(sortieId, entreeId);
  return { ...f, depenses: f.depenses.map((x): Depense => (x.id === sortieId ? { ...x, lien } : x)), revenus: (f.revenus || []).map((x): Revenu => (x.id === entreeId ? { ...x, lien } : x)) };
}

/** Défait un lien : les deux opérations redeviennent une dépense et un revenu. */
export function delier(f: Finances, lien: string): Finances {
  const sans = <T extends { lien?: string }>(x: T): T => {
    if (x.lien !== lien) return x;
    const { lien: _, ...reste } = x;
    return reste as T;
  };
  return { ...f, depenses: f.depenses.map(sans), revenus: f.revenus?.map(sans) };
}

/** Écarte une proposition de virement : elle ne revient plus. */
export const ignorerLien = (f: Finances, sortieId: string, entreeId: string): Finances => ({ ...f, liensIgnores: [...(f.liensIgnores || []), `${sortieId}|${entreeId}`] });

export type Proposition = { sortie: OpLiable; entree: OpLiable; /** Écart de montant entre les deux moitiés (frais éventuels). */ ecart: number; jours: number };

/**
 * Virements probables entre deux comptes : une sortie d'un compte, une entrée d'un autre compte, à peu près le même montant,
 * à quelques jours d'écart. Chaque opération n'est proposée qu'une fois (les meilleurs rapprochements d'abord).
 * C'est une proposition : rien n'est lié sans l'accord de l'utilisateur.
 */
export function proposerLiens(ops: OpLiable[], { jours = 3, tolerance = 0.02, ignores = [] }: { jours?: number; tolerance?: number; ignores?: string[] } = {}): Proposition[] {
  const ecartees = new Set(ignores);
  const libres = ops.filter((x) => !x.lien && x.compte);
  const entrees = libres.filter((x) => x.sens === 'entree');
  const parDate = new Map<string, OpLiable[]>();
  for (const e of entrees) parDate.set(e.date, [...(parDate.get(e.date) || []), e]);
  const paires: Proposition[] = [];
  for (const s of libres) {
    if (s.sens !== 'sortie') continue;
    for (let d = -jours; d <= jours; d++) {
      const date = new Date(ms(s.date) + d * 864e5).toISOString().slice(0, 10);
      for (const e of parDate.get(date) || []) {
        if (e.compte === s.compte || ecartees.has(`${s.id}|${e.id}`)) continue;
        const ecart = ecartMontant(s.montant, e.montant);
        if (ecart > Math.max(0.01, tolerance * Math.max(s.montant, e.montant))) continue;
        paires.push({ sortie: s, entree: e, ecart, jours: Math.abs(d) });
      }
    }
  }
  paires.sort((a, z) => a.ecart - z.ecart || a.jours - z.jours || a.sortie.date.localeCompare(z.sortie.date) || a.sortie.id.localeCompare(z.sortie.id) || a.entree.id.localeCompare(z.entree.id));
  const pris = new Set<string>();
  const retenues: Proposition[] = [];
  for (const p of paires) {
    if (pris.has(p.sortie.id) || pris.has(p.entree.id)) continue;
    pris.add(p.sortie.id);
    pris.add(p.entree.id);
    retenues.push(p);
  }
  return retenues.sort((a, z) => z.sortie.date.localeCompare(a.sortie.date) || a.sortie.id.localeCompare(z.sortie.id));
}

/** Opérations à proposer pour lier celle-ci à la main : le sens opposé, pas déjà liées, à moins de `jours` jours, les plus proches en montant d'abord. */
export function candidatsLien<T extends OpLiable>(ops: T[], op: OpLiable, { jours = 10, max = 8 }: { jours?: number; max?: number } = {}): T[] {
  return ops
    .filter((x) => x.id !== op.id && x.sens !== op.sens && !x.lien && ecartJours(x.date, op.date) <= jours)
    .sort((a, z) => ecartMontant(a.montant, op.montant) - ecartMontant(z.montant, op.montant) || ecartJours(a.date, op.date) - ecartJours(z.date, op.date) || a.id.localeCompare(z.id))
    .slice(0, max);
}

/** Virements liés : nombre de virements et somme de ce qui est sorti. */
export function virements(ops: OpLiable[]) {
  const sorties = ops.filter((x) => x.lien && x.sens === 'sortie');
  return { nb: sorties.length, total: arrondi(sorties.reduce((s, x) => s + x.montant, 0)) };
}

/** L'autre moitié d'un virement. */
export const autreMoitie = <T extends OpLiable>(ops: T[], op: OpLiable): T | undefined => (op.lien ? ops.find((x) => x.lien === op.lien && x.id !== op.id) : undefined);

// ——— Vue d'ensemble des comptes ———

export type ResumeCompte = {
  /** Null : les opérations sans compte. */
  id: string | null;
  compte: Compte | null;
  nb: number;
  /** Entrées et sorties réelles : les virements entre comptes n'en font pas partie. */
  entrees: number;
  sorties: number;
  virementsRecus: number;
  virementsEnvoyes: number;
  premiere: string | null;
  derniere: string | null;
};

export function resumerComptes(ops: OpLiable[], comptes: Compte[]): ResumeCompte[] {
  const vide = (id: string | null, compte: Compte | null): ResumeCompte => ({ id, compte, nb: 0, entrees: 0, sorties: 0, virementsRecus: 0, virementsEnvoyes: 0, premiere: null, derniere: null });
  const m = new Map<string | null, ResumeCompte>(comptes.map((c) => [c.id, vide(c.id, c)]));
  for (const x of ops) {
    const k = x.compte && m.has(x.compte) ? x.compte : null;
    const r = m.get(k) || vide(k, null);
    m.set(k, r);
    r.nb++;
    if (x.lien) {
      if (x.sens === 'entree') r.virementsRecus += x.montant;
      else r.virementsEnvoyes += x.montant;
    } else if (x.sens === 'entree') r.entrees += x.montant;
    else r.sorties += x.montant;
    if (!r.premiere || x.date < r.premiere) r.premiere = x.date;
    if (!r.derniere || x.date > r.derniere) r.derniere = x.date;
  }
  return [...m.values()].map((r) => ({ ...r, entrees: arrondi(r.entrees), sorties: arrondi(r.sorties), virementsRecus: arrondi(r.virementsRecus), virementsEnvoyes: arrondi(r.virementsEnvoyes) }));
}

// ——— Virements entre mes comptes, mis en avant ———

/** Un virement entre deux de mes comptes, ses deux moitiés réunies : d'où, vers où, combien, quand. */
export type Virement = { lien: string; date: string; de: string | null; vers: string | null; montant: number; recu: number; /** Écart entre l'envoyé et le reçu (frais). */ frais: number; note: string; sortie: string; entree: string | null };

/** Les virements liés, du plus récent au plus ancien. Une moitié seule (l'autre supprimée) reste listée, sans destination. */
export function listeVirements(ops: (OpLiable & { note?: string })[]): Virement[] {
  const entrees = new Map(ops.filter((x) => x.lien && x.sens === 'entree').map((x) => [x.lien!, x]));
  return ops
    .filter((x) => x.lien && x.sens === 'sortie')
    .map((s) => {
      const e = entrees.get(s.lien!);
      return { lien: s.lien!, date: s.date, de: s.compte, vers: e?.compte ?? null, montant: s.montant, recu: e?.montant ?? 0, frais: e ? arrondi(Math.max(0, s.montant - e.montant)) : 0, note: s.note || e?.note || '', sortie: s.id, entree: e?.id ?? null };
    })
    .sort((a, z) => z.date.localeCompare(a.date) || a.lien.localeCompare(z.lien));
}

/**
 * Note un virement d'un de mes comptes à un autre : une sortie dans le premier, une entrée dans le second, déjà liées.
 * `recu` : ce qui arrive (moins s'il y a des frais), le montant envoyé par défaut. Null si les comptes sont les mêmes ou le montant nul.
 */
export function creerVirement(f: Finances, v: { id: string; de: string; vers: string; montant: number; recu?: number; date: string; note?: string; creeLe: string }): Finances | null {
  if (v.de === v.vers || !(v.montant > 0)) return null;
  const sortie = `${v.id}-s`;
  const entree = `${v.id}-e`;
  const lien = lienId(sortie, entree);
  const note = v.note?.trim() || `Virement vers ${nomCompte(f, v.vers)}`;
  const d: Depense = { id: sortie, montant: v.montant, note, budget: null, date: v.date, creeLe: v.creeLe, compte: v.de, lien };
  const r: Revenu = { id: entree, montant: v.recu && v.recu > 0 ? v.recu : v.montant, note: v.note?.trim() || `Virement depuis ${nomCompte(f, v.de)}`, date: v.date, creeLe: v.creeLe, compte: v.vers, lien };
  return { ...f, depenses: [d, ...f.depenses], revenus: [r, ...(f.revenus || [])] };
}
