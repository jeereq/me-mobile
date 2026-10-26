import type { Budget, Finances } from './types';

/**
 * Filtres, agrégats pour les graphiques et recommandations de l'onglet Opérations.
 * Tout est calculé à la volée depuis les dépenses (sorties) et revenus (entrées) ; aucune dépendance, donc testable seul.
 */

export type Operation = {
  id: string;
  sens: 'sortie' | 'entree';
  date: string;
  montant: number;
  note: string;
  budget: string | null;
  /** Catégories de l'opération (une ou plusieurs). */
  categories: string[];
  /** Compte d'où vient l'opération. */
  compte: string | null;
  /** Identifiant du virement entre comptes dont elle est une moitié. */
  lien: string | null;
  origine?: { montant: number; devise: string };
  importee: boolean;
};

export type Sens = 'toutes' | 'sorties' | 'entrees';
export type Tri = 'recentes' | 'anciennes' | 'gros' | 'petits';
export type Origine = 'toutes' | 'importees' | 'saisies';
export type Virements = 'tous' | 'sans' | 'seuls';

export type Filtres = {
  /** « tout », « 30j », « 90j », « 12m », une année (« 2025 ») ou un mois (« 2025-03 »). */
  periode: string;
  sens: Sens;
  /** « tous », « hors » (sans budget) ou l'identifiant d'un budget. */
  budget: string;
  /** « toutes », « aucune » (sans catégorie) ou l'identifiant d'une catégorie. */
  categorie: string;
  min: number | null;
  max: number | null;
  origine: Origine;
  /** « tous », « aucun » (sans compte) ou l'identifiant d'un compte. */
  compte: string;
  /** Virements entre mes comptes : tous les voir, les masquer, ou ne voir qu'eux. */
  virements: Virements;
  /** Libellé, budget, catégorie ou montant ; « a|b » cherche a ou b. */
  recherche: string;
  tri: Tri;
};

export const FILTRES_VIDES: Filtres = { periode: 'tout', sens: 'toutes', budget: 'tous', categorie: 'toutes', min: null, max: null, origine: 'toutes', compte: 'tous', virements: 'tous', recherche: '', tri: 'recentes' };

/** Nombre de filtres actifs (le tri n'en est pas un). */
export function nbFiltres(f: Filtres) {
  return [f.periode !== 'tout', f.sens !== 'toutes', f.budget !== 'tous', f.categorie !== 'toutes', f.min != null, f.max != null, f.origine !== 'toutes', f.compte !== 'tous', f.virements !== 'tous', f.recherche.trim() !== ''].filter(Boolean).length;
}

const arrondi = (n: number) => Math.round(n * 100) / 100;
const somme = (l: { montant: number }[]) => arrondi(l.reduce((s, x) => s + x.montant, 0));
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const ms = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const plusJours = (s: string, n: number) => iso(ms(s) + n * 864e5);
const dernierJour = (mois: string) => iso(Date.UTC(+mois.slice(0, 4), +mois.slice(5, 7), 0));
const moisPlus = (mois: string, n: number) => {
  const t = +mois.slice(0, 4) * 12 + (+mois.slice(5, 7) - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

export const libelleMois = (m: string) => `${MOIS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
export const libelleMoisLong = (m: string) => `${MOIS_LONGS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
export const libelleMoisCourt = (m: string) => MOIS[+m.slice(5, 7) - 1].replace('.', '');
const dateFr = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

/** `budgetDe` donne le budget qui compte une dépense (voir `categories.ts`) ; par défaut, celui choisi à la main. */
export function operationsDe(f: Finances, budgetDe: (d: Finances['depenses'][number]) => string | null = (d) => d.budget): Operation[] {
  return [
    ...f.depenses.map((x) => ({ id: x.id, sens: 'sortie' as const, date: x.date, montant: x.montant, note: x.note, budget: budgetDe(x), categories: x.categories ?? [], compte: x.compte ?? null, lien: x.lien ?? null, origine: x.origine, importee: !!x.reference })),
    ...(f.revenus || []).map((x) => ({ id: x.id, sens: 'entree' as const, date: x.date, montant: x.montant, note: x.note, budget: null, categories: x.categories ?? [], compte: x.compte ?? null, lien: x.lien ?? null, origine: x.origine, importee: !!x.reference })),
  ];
}

/**
 * Date de référence des périodes relatives (« 30 j », « 3 mois »…) : aujourd'hui, ou la dernière opération si elle est plus ancienne
 * (on vient d'importer un vieux relevé, « les 30 derniers jours » doivent montrer quelque chose).
 */
export function ancre(ops: Operation[], aujourdhui: string) {
  const derniere = ops.reduce((m, x) => (x.date > m ? x.date : m), '');
  return derniere && derniere < aujourdhui ? derniere : aujourdhui;
}

/** Bornes (incluses) d'une période ; `null` = sans limite. */
export function bornes(periode: string, ref: string): { debut: string | null; fin: string | null } {
  if (periode === '30j') return { debut: plusJours(ref, -29), fin: ref };
  if (periode === '90j') return { debut: plusJours(ref, -89), fin: ref };
  if (periode === '12m') return { debut: plusJours(ref, -364), fin: ref };
  if (/^\d{4}$/.test(periode)) return { debut: `${periode}-01-01`, fin: `${periode}-12-31` };
  if (/^\d{4}-\d{2}$/.test(periode)) return { debut: `${periode}-01`, fin: dernierJour(periode) };
  return { debut: null, fin: null };
}

/** Années et mois qui contiennent des opérations, du plus récent au plus ancien. */
export function periodesDisponibles(ops: Operation[]) {
  const mois = [...new Set(ops.map((x) => x.date.slice(0, 7)))].sort().reverse();
  const annees = [...new Set(mois.map((m) => m.slice(0, 4)))];
  return { mois, annees };
}

const normaliser = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export function appliquer(ops: Operation[], fi: Filtres, ref: string, nomBudget: (id: string | null) => string, nomsCategories: (ids: string[]) => string = () => ''): Operation[] {
  const { debut, fin } = bornes(fi.periode, ref);
  const termes = normaliser(fi.recherche).split('|').map((t) => t.trim()).filter(Boolean);
  const liste = ops.filter((x) => {
    if (debut && x.date < debut) return false;
    if (fin && x.date > fin) return false;
    if (fi.sens === 'sorties' && x.sens !== 'sortie') return false;
    if (fi.sens === 'entrees' && x.sens !== 'entree') return false;
    if (fi.budget !== 'tous') {
      if (x.sens !== 'sortie') return false;
      if (fi.budget === 'hors' ? x.budget != null : x.budget !== fi.budget) return false;
    }
    if (fi.categorie === 'aucune' ? x.categories.length > 0 : fi.categorie !== 'toutes' && !x.categories.includes(fi.categorie)) return false;
    if (fi.min != null && x.montant < fi.min) return false;
    if (fi.max != null && x.montant > fi.max) return false;
    if (fi.compte === 'aucun' ? x.compte != null : fi.compte !== 'tous' && x.compte !== fi.compte) return false;
    if (fi.virements === 'sans' && x.lien) return false;
    if (fi.virements === 'seuls' && !x.lien) return false;
    if (fi.origine === 'importees' && !x.importee) return false;
    if (fi.origine === 'saisies' && x.importee) return false;
    if (termes.length) {
      const texte = normaliser(`${x.note} ${nomBudget(x.budget)} ${nomsCategories(x.categories)} ${x.montant}`);
      if (!termes.some((t) => texte.includes(t))) return false;
    }
    return true;
  });
  const parDate = (a: Operation, z: Operation) => z.date.localeCompare(a.date) || a.sens.localeCompare(z.sens);
  return liste.sort(
    fi.tri === 'anciennes' ? (a, z) => -parDate(a, z) : fi.tri === 'gros' ? (a, z) => z.montant - a.montant || parDate(a, z) : fi.tri === 'petits' ? (a, z) => a.montant - z.montant || parDate(a, z) : parDate,
  );
}

export function totaux(ops: Operation[]) {
  const e = ops.filter((x) => x.sens === 'entree');
  const s = ops.filter((x) => x.sens === 'sortie');
  const entrees = somme(e);
  const sorties = somme(s);
  return { entrees, sorties, solde: arrondi(entrees - sorties), nbEntrees: e.length, nbSorties: s.length };
}

// ——— Graphiques ———

export type MoisOps = { mois: string; entrees: number; sorties: number };

/** Entrées et sorties par mois, sans trou entre le premier et le dernier mois (les 24 derniers au plus). */
export function parMois(ops: Operation[]): MoisOps[] {
  if (!ops.length) return [];
  const m = new Map<string, MoisOps>();
  for (const x of ops) {
    const k = x.date.slice(0, 7);
    const e = m.get(k) || { mois: k, entrees: 0, sorties: 0 };
    if (x.sens === 'entree') e.entrees += x.montant;
    else e.sorties += x.montant;
    m.set(k, e);
  }
  const cles = [...m.keys()].sort();
  const sortie: MoisOps[] = [];
  for (let k = cles[0]; k <= cles[cles.length - 1]; k = moisPlus(k, 1)) {
    const e = m.get(k) || { mois: k, entrees: 0, sorties: 0 };
    sortie.push({ mois: k, entrees: arrondi(e.entrees), sorties: arrondi(e.sorties) });
  }
  return sortie.slice(-24);
}

/** Variation cumulée (entrées − sorties) jour après jour, depuis la première opération sélectionnée. */
export function cumul(ops: Operation[]): { date: string; v: number }[] {
  const jours = new Map<string, number>();
  for (const x of ops) jours.set(x.date, (jours.get(x.date) || 0) + (x.sens === 'entree' ? x.montant : -x.montant));
  let v = 0;
  return [...jours.keys()].sort().map((date) => {
    v = arrondi(v + jours.get(date)!);
    return { date, v };
  });
}

export type Poste = { cle: string; nom: string; emoji?: string; total: number; n: number };

/** Sorties par budget, « Hors budget » à part ; du plus gros au plus petit. */
export function parCategorie(ops: Operation[], budgets: Budget[]): Poste[] {
  const m = new Map<string, Poste>();
  for (const x of ops) {
    if (x.sens !== 'sortie') continue;
    const b = budgets.find((y) => y.id === x.budget);
    const cle = b ? b.id : 'hors';
    const e = m.get(cle) || { cle, nom: b ? b.nom : 'Hors budget', emoji: b?.emoji, total: 0, n: 0 };
    e.total += x.montant;
    e.n++;
    m.set(cle, e);
  }
  return [...m.values()].map((e) => ({ ...e, total: arrondi(e.total) })).sort((a, z) => z.total - a.total);
}

const cleLibelle = (note: string) => normaliser(note).replace(/\d{4,}/g, '').replace(/\s+/g, ' ').trim();

/** Sorties regroupées par libellé (« Retrait ATM », « Marché »…) ; du plus gros au plus petit. */
export function parLibelle(ops: Operation[], sens: 'sortie' | 'entree' = 'sortie'): Poste[] {
  const m = new Map<string, Poste>();
  for (const x of ops) {
    if (x.sens !== sens) continue;
    const cle = cleLibelle(x.note) || '(sans libellé)';
    const e = m.get(cle) || { cle, nom: x.note.trim() || '(sans libellé)', total: 0, n: 0 };
    e.total += x.montant;
    e.n++;
    m.set(cle, e);
  }
  return [...m.values()].map((e) => ({ ...e, total: arrondi(e.total) })).sort((a, z) => z.total - a.total);
}

export const JOURS_COURTS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
export const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Total des sorties par jour de la semaine (lundi en premier). */
export function parJourSemaine(ops: Operation[]): { total: number; n: number }[] {
  const j = Array.from({ length: 7 }, () => ({ total: 0, n: 0 }));
  for (const x of ops) {
    if (x.sens !== 'sortie') continue;
    const i = (new Date(ms(x.date)).getUTCDay() + 6) % 7;
    j[i].total += x.montant;
    j[i].n++;
  }
  return j.map((e) => ({ total: arrondi(e.total), n: e.n }));
}

// ——— Recommandations ———

export type Reco = {
  id: string;
  niveau: 'alerte' | 'conseil' | 'info' | 'bien';
  titre: string;
  texte: string;
  /** Filtre à appliquer pour voir les opérations concernées. */
  voir?: Partial<Pick<Filtres, 'recherche' | 'budget' | 'sens'>>;
};

export type ContexteReco = {
  budgets: Budget[];
  /** Notes des paiements récurrents déjà créés (pour ne pas les proposer une seconde fois). */
  recurrences: string[];
  fmt: (n: number) => string;
  /** Même date de référence que pour les filtres : sert à ignorer le mois en cours, pas terminé. */
  ref: string;
};

const RE_FRAIS = /\b(frais|tva|commission|fee|fees|agios)\b/i;
const RE_RETRAIT = /\b(retrait|retraits|atm|withdrawal|cash)\b/i;
const RE_FRAIS_RETRAIT = /(frais|tva|fee|commission).*(retrait|atm|withdrawal)/i;
const NIVEAUX: Reco['niveau'][] = ['alerte', 'conseil', 'info', 'bien'];

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (x: number) => `${Math.round(x * 100)} %`;
const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

/**
 * Ce que les opérations sélectionnées disent, en phrases simples : déficit ou épargne, frais bancaires, retraits en espèces,
 * sorties sans budget, plus gros poste, grosse dépense isolée, évolution du dernier mois, paiements qui reviennent chaque mois.
 * Aucune règle ne se déclenche sans assez de chiffres derrière.
 */
export function recommandations(ops: Operation[], ctx: ContexteReco): Reco[] {
  const sorties = ops.filter((x) => x.sens === 'sortie');
  const entrees = ops.filter((x) => x.sens === 'entree');
  if (ops.length < 8) {
    return [{ id: 'peu', niveau: 'info', titre: 'Pas encore assez de données', texte: 'Il faut quelques semaines d’opérations pour que les conseils veuillent dire quelque chose. Importe ton relevé bancaire ou note tes dépenses au fil de l’eau.' }];
  }
  const { fmt } = ctx;
  const S = somme(sorties);
  const E = somme(entrees);
  const mois = parMois(ops);
  const nbMois = Math.max(1, mois.length);
  const r: Reco[] = [];

  // 1. Équilibre entre ce qui rentre et ce qui sort.
  if (E > 0 && S > E) {
    const manque = arrondi(S - E);
    r.push({
      id: 'deficit',
      niveau: 'alerte',
      titre: 'Tu dépenses plus que tu ne reçois',
      texte: `Sur cette sélection, les sorties (${fmt(S)}) dépassent les entrées (${fmt(E)}) de ${fmt(manque)}${nbMois > 1 ? `, soit environ ${fmt(arrondi(manque / nbMois))} de moins chaque mois` : ''}. Repère les postes à réduire dans l’onglet Graphiques.`,
    });
  } else if (E > 0) {
    const garde = (E - S) / E;
    r.push(
      garde >= 0.2
        ? { id: 'epargne', niveau: 'bien', titre: `Tu gardes ${pct(garde)} de tes entrées`, texte: `${fmt(arrondi(E - S))} de côté sur ${fmt(E)} reçus. Mets-le sur un budget d’épargne pour qu’il ne se dilue pas dans les dépenses du quotidien.` }
        : { id: 'epargne', niveau: 'conseil', titre: garde < 0.01 ? 'Tu ne gardes presque rien de tes entrées' : `Tu ne gardes que ${pct(garde)} de tes entrées`, texte: `Il reste ${fmt(arrondi(E - S))} sur ${fmt(E)} reçus. Mettre de côté 10 à 20 % dès l’arrivée de l’argent, avant de dépenser, est un repère courant.` },
    );
  } else if (S > 0) {
    r.push({ id: 'sans-entree', niveau: 'info', titre: 'Aucune entrée sur cette sélection', texte: 'Sans entrées, on ne peut ni calculer ce que tu gardes ni repérer un déficit. Élargis la période ou ajoute tes revenus.' });
  }

  if (S > 0) {
    // 2. Frais et taxes de banque, retraits en espèces.
    const frais = sorties.filter((x) => RE_FRAIS.test(x.note));
    const F = somme(frais);
    const fraisRetrait = somme(frais.filter((x) => RE_FRAIS_RETRAIT.test(x.note)));
    const retraits = sorties.filter((x) => !RE_FRAIS.test(x.note) && RE_RETRAIT.test(x.note));
    const R = somme(retraits);
    if (F > 0 && F / S >= 0.01) {
      r.push({
        id: 'frais',
        niveau: 'conseil',
        titre: `${fmt(F)} de frais et taxes bancaires`,
        texte: `Ça représente ${pct(F / S)} de tes sorties${nbMois > 1 ? `, environ ${fmt(arrondi(F / nbMois))} par mois` : ''}. Compare avec les offres de ta banque ou d’un portefeuille mobile, et demande-lui si certains frais (tenue de compte, retraits) peuvent baisser.`,
        voir: { recherche: 'frais|tva|commission|fee|agios', sens: 'sorties' },
      });
    }
    if (retraits.length >= 4 && R / S >= 0.25) {
      const moyenne = arrondi(R / retraits.length);
      r.push({
        id: 'retraits',
        niveau: 'conseil',
        titre: `Les retraits pèsent ${pct(R / S)} de tes sorties`,
        texte: `${retraits.length} retraits pour ${fmt(R)} (${fmt(moyenne)} en moyenne). On ne voit pas où part l’argent liquide${fraisRetrait > 0 ? `, et les frais et taxes liés aux retraits ont coûté ${fmt(fraisRetrait)}` : ''}. Note ce que tu paies en espèces, ou paie directement par mobile ou par carte quand c’est possible.`,
        voir: { recherche: 'retrait|atm', sens: 'sorties' },
      });
    }

    // 3. Sorties sans budget / budgets à créer.
    const hors = sorties.filter((x) => !ctx.budgets.some((b) => b.id === x.budget));
    const H = somme(hors);
    if (!ctx.budgets.length) {
      r.push({ id: 'sans-budget', niveau: 'conseil', titre: 'Crée tes premiers budgets', texte: 'Sans budget, rien ne dit si tu dépenses trop pour la nourriture, le transport ou les loisirs. Trois ou quatre budgets suffisent pour commencer.' });
    } else if (hors.length >= 3 && H / S >= 0.3) {
      r.push({ id: 'hors-budget', niveau: 'conseil', titre: `${pct(H / S)} de tes sorties n’ont pas de budget`, texte: `${hors.length} sorties pour ${fmt(H)} ne sont rangées dans aucun budget : elles échappent aux alertes et aux prévisions. Classe les plus grosses d’abord.`, voir: { budget: 'hors', sens: 'sorties' } });
    }

    // 4. Plus gros poste (hors frais et retraits, déjà traités).
    const postes = parLibelle(sorties).filter((p) => !RE_FRAIS.test(p.nom) && !RE_RETRAIT.test(p.nom));
    const top = postes[0];
    if (top && top.n >= 3 && top.total / S >= 0.25) {
      r.push({ id: 'poste', niveau: 'info', titre: `« ${top.nom} » est ton plus gros poste`, texte: `${top.n} sorties pour ${fmt(top.total)}, soit ${pct(top.total / S)} de tes sorties. Une baisse de 10 % ici vaut ${fmt(arrondi(top.total * 0.1))}.`, voir: { recherche: top.nom, sens: 'sorties' } });
    }

    // 5. Une dépense isolée qui écrase le reste.
    const tri = [...sorties].sort((a, z) => z.montant - a.montant);
    const mediane = tri[Math.floor(tri.length / 2)].montant;
    const grosse = tri[0];
    if (sorties.length >= 10 && grosse.montant >= 5 * mediane && grosse.montant / S >= 0.1) {
      r.push({ id: 'grosse', niveau: 'info', titre: `Une seule sortie pèse ${pct(grosse.montant / S)}`, texte: `${fmt(grosse.montant)} le ${dateFr(grosse.date)}${grosse.note ? ` (${grosse.note})` : ''}, contre ${fmt(mediane)} pour une sortie ordinaire. Si elle ne se répète pas, elle fausse ta moyenne mensuelle.`, voir: { recherche: grosse.note || String(grosse.montant), sens: 'sorties' } });
    }

    // 6. Dernier mois terminé contre la moyenne des précédents.
    const termines = mois.filter((m) => dernierJour(m.mois) <= ctx.ref);
    if (termines.length >= 3) {
      const dernier = termines[termines.length - 1];
      const avant = termines.slice(-7, -1);
      const moy = avant.reduce((s, m) => s + m.sorties, 0) / avant.length;
      if (moy > 0 && dernier.sorties > 0) {
        const ecart = (dernier.sorties - moy) / moy;
        if (ecart >= 0.25) r.push({ id: 'hausse', niveau: 'alerte', titre: `Sorties en hausse en ${libelleMoisLong(dernier.mois)}`, texte: `${fmt(dernier.sorties)} contre ${fmt(arrondi(moy))} en moyenne les mois d’avant (+${Math.round(ecart * 100)} %). Cherche ce qui a changé dans les graphiques du mois.`, voir: { sens: 'sorties' } });
        else if (ecart <= -0.25) r.push({ id: 'baisse', niveau: 'bien', titre: `Sorties en baisse en ${libelleMoisLong(dernier.mois)}`, texte: `${fmt(dernier.sorties)} contre ${fmt(arrondi(moy))} en moyenne les mois d’avant (${Math.round(ecart * 100)} %). Garde ce qui a marché.` });
      }
    }

    // 6 bis. Un mois nettement plus cher que les autres.
    const complets = mois.filter((m) => dernierJour(m.mois) <= ctx.ref && m.sorties > 0);
    if (complets.length >= 4) {
      const ordre = complets.map((m) => m.sorties).sort((a, z) => a - z);
      const med = ordre[Math.floor(ordre.length / 2)];
      const haut = complets.reduce((m, x) => (x.sorties > m.sorties ? x : m), complets[0]);
      if (med > 0 && haut.sorties >= 1.6 * med) {
        r.push({ id: 'pic', niveau: 'info', titre: `${majuscule(libelleMoisLong(haut.mois))} est ton mois le plus cher`, texte: `${fmt(haut.sorties)} de sorties, contre ${fmt(med)} pour un mois ordinaire. Regarde ce qui s’y est ajouté pour voir si ça va se reproduire.`, voir: { sens: 'sorties' } });
      }
    }

    // 7. Paiements qui reviennent chaque mois, pas encore en récurrent.
    const dejaRecurrents = new Set(ctx.recurrences.map(cleLibelle));
    const reguliers = parLibelle(sorties)
      .map((p) => {
        const l = sorties.filter((x) => (cleLibelle(x.note) || '(sans libellé)') === p.cle);
        const moisDistincts = new Set(l.map((x) => x.date.slice(0, 7))).size;
        const min = Math.min(...l.map((x) => x.montant));
        const max = Math.max(...l.map((x) => x.montant));
        return { nom: p.nom, cle: p.cle, moisDistincts, n: l.length, mensuel: arrondi(p.total / moisDistincts), ok: moisDistincts >= 3 && l.length <= moisDistincts * 1.5 && max <= min * 1.15 };
      })
      .filter((p) => p.ok && !dejaRecurrents.has(p.cle) && p.cle !== '(sans libellé)' && !RE_FRAIS.test(p.nom))
      .sort((a, z) => z.mensuel - a.mensuel)
      .slice(0, 3);
    if (reguliers.length) {
      r.push({
        id: 'reguliers',
        niveau: 'conseil',
        titre: `${reguliers.length} ${pluriel(reguliers.length, 'paiement revient', 'paiements reviennent')} chaque mois`,
        texte: `${reguliers.map((p) => `${p.nom} (${fmt(p.mensuel)})`).join(', ')}. Ajoute-${pluriel(reguliers.length, 'le', 'les')} dans Réglages › Paiements récurrents pour que les prévisions en tiennent compte.`,
        voir: { recherche: reguliers.map((p) => p.nom).join('|'), sens: 'sorties' },
      });
    }
  }

  return r.sort((a, z) => NIVEAUX.indexOf(a.niveau) - NIVEAUX.indexOf(z.niveau));
}
