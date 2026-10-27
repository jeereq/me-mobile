import type { Projet, Tache } from './types';

/**
 * Planning d'un projet : tâches, sous-tâches, liens « fin → début », dates calculées, marge et chemin critique.
 *
 * - Une tâche qui a des sous-tâches est un « résumé » : ses dates, sa durée et son avancement viennent d'elles.
 * - Un lien « après » veut dire : cette tâche commence le lendemain de la fin de l'autre (plus `delai` jours d'attente).
 *   Lié à un résumé, il vaut pour toutes ses sous-tâches ; un résumé lié à une tâche retarde toutes ses sous-tâches.
 * - Les dates d'une tâche « figée » (saisies à la main ou lues dans un fichier, ou tâche déjà faite) ne bougent pas ; les autres
 *   sont recalculées à partir du début du projet, des durées et des liens. Un lien qui n'est pas tenu par une date figée est un « conflit ».
 * - Un jalon (durée 0) tombe le jour où finissent les tâches précédentes.
 * - Jours ouvrés : le samedi et le dimanche ne comptent pas (réglage du projet).
 * - Chemin critique : les tâches enchaînées par des liens sans aucune marge, celles qui décalent la fin du projet si elles glissent.
 *
 * Dates en texte « AAAA-MM-JJ », calculées en UTC : le fuseau de l'appareil n'intervient pas.
 * Ce fichier n'importe que des types : il se teste avec `npm test`.
 */

/* ---------- Dates ---------- */

const ms = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const plusJours = (s: string, n: number) => iso(ms(s) + n * 864e5);
export const ecartJours = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 864e5);
export const jourDeSemaine = (s: string) => new Date(ms(s)).getUTCDay();
export const estOuvre = (s: string) => {
  const j = jourDeSemaine(s);
  return j !== 0 && j !== 6;
};

const plancher = (a: number, b: number) => Math.floor(a / b);
const reste = (a: number, b: number) => a - b * Math.floor(a / b);
const LUNDI_REF = ms('1970-01-05');

/**
 * Position d'un jour sur la ligne du temps : le numéro du jour, ou, en jours ouvrés, le numéro du jour ouvré
 * (un samedi ou un dimanche se range sur le lundi suivant pour un début, sur le vendredi précédent pour une fin).
 */
export function versPosition(date: string, ouvres: boolean, sens: 'debut' | 'fin' = 'debut'): number {
  if (!ouvres) return Math.round(ms(date) / 864e5);
  const n = Math.round((ms(date) - LUNDI_REF) / 864e5);
  const semaines = plancher(n, 7);
  const j = reste(n, 7);
  if (j < 5) return semaines * 5 + j;
  return sens === 'debut' ? (semaines + 1) * 5 : semaines * 5 + 4;
}
export function depuisPosition(p: number, ouvres: boolean): string {
  if (!ouvres) return iso(p * 864e5);
  return iso(LUNDI_REF + (plancher(p, 5) * 7 + reste(p, 5)) * 864e5);
}

/** Nombre de jours (ouvrés si demandé) du jour `debut` au jour `fin` inclus ; au moins 1. */
export function dureeEntre(debut: string, fin: string, ouvres: boolean) {
  return Math.max(1, versPosition(fin, ouvres, 'fin') - versPosition(debut, ouvres, 'debut') + 1);
}
/** Dernier jour d'un travail de `duree` jours commencé le `debut`. */
export function finDepuis(debut: string, duree: number, ouvres: boolean) {
  const p = versPosition(debut, ouvres, 'debut');
  return depuisPosition(p + Math.max(1, Math.round(duree)) - 1, ouvres);
}
/** Décale une date de n jours (ouvrés si demandé). */
export function decalerDate(date: string, n: number, ouvres: boolean) {
  return depuisPosition(versPosition(date, ouvres, n < 0 ? 'fin' : 'debut') + n, ouvres);
}

/* ---------- Arbre des tâches ---------- */

/** Ensemble des identifiants de tâches qui ont des sous-tâches. */
export function resumes(taches: Pick<Tache, 'parent'>[]): Set<string> {
  const s = new Set<string>();
  for (const t of taches) if (t.parent) s.add(t.parent);
  return s;
}

/** Les tâches qui comptent vraiment (ni résumé) : à rappeler, à compter, à cocher. */
export function sansResumes<T extends Pick<Tache, 'id' | 'parent'>>(taches: T[]): T[] {
  const r = resumes(taches);
  return r.size ? taches.filter((t) => !r.has(t.id)) : taches;
}

export const tachesDuProjet = (taches: Tache[], projet: string) => taches.filter((t) => t.projet === projet);

type Noeud = { t: Tache; enfants: Noeud[] };

/** Les tâches d'un projet en arbre, dans l'ordre du fichier ; un parent absent du projet est ignoré, un cycle de parents est coupé. */
function arbreDe(taches: Tache[]): { racines: Noeud[]; noeuds: Map<string, Noeud> } {
  const noeuds = new Map<string, Noeud>(taches.map((t) => [t.id, { t, enfants: [] }]));
  const rang = new Map(taches.map((t, i) => [t.id, t.ordre ?? 1e9 + i]));
  const racines: Noeud[] = [];
  for (const n of noeuds.values()) {
    // Remonter la chaîne des parents : si elle revient sur la tâche, c'est un cycle, la tâche devient une racine.
    let p = n.t.parent;
    let tours = 0;
    let ok = !!p && noeuds.has(p);
    while (ok && p && tours++ < 200) {
      if (p === n.t.id) ok = false;
      p = noeuds.get(p)?.t.parent;
    }
    if (ok && n.t.parent && noeuds.has(n.t.parent)) noeuds.get(n.t.parent)!.enfants.push(n);
    else racines.push(n);
  }
  const trier = (l: Noeud[]) => {
    l.sort((a, b) => rang.get(a.t.id)! - rang.get(b.t.id)!);
    l.forEach((n) => trier(n.enfants));
  };
  trier(racines);
  return { racines, noeuds };
}

/** Les tâches dans l'ordre d'affichage (parent puis ses sous-tâches), avec leur niveau d'imbrication. */
export function ordreAffichage(taches: Tache[]): { tache: Tache; niveau: number }[] {
  const { racines } = arbreDe(taches);
  const sortie: { tache: Tache; niveau: number }[] = [];
  const marcher = (l: Noeud[], niveau: number) => l.forEach((n) => (sortie.push({ tache: n.t, niveau }), marcher(n.enfants, niveau + 1)));
  marcher(racines, 0);
  return sortie;
}

/** Identifiants d'une tâche et de toutes ses descendantes. */
export function descendantes(taches: Tache[], id: string): Set<string> {
  const { noeuds } = arbreDe(taches);
  const s = new Set<string>();
  const marcher = (n: Noeud | undefined) => {
    if (!n || s.has(n.t.id)) return;
    s.add(n.t.id);
    n.enfants.forEach(marcher);
  };
  marcher(noeuds.get(id));
  return s;
}

/* ---------- Planification ---------- */

export type LignePlan = {
  id: string;
  debut: string;
  fin: string;
  /** Durée en jours (ouvrés si le projet les utilise). */
  duree: number;
  niveau: number;
  resume: boolean;
  jalon: boolean;
  /** Jours dont la tâche peut glisser sans décaler la fin du projet. */
  marge: number;
  critique: boolean;
  /** Dates figées qui ne tiennent pas un lien (la tâche commence avant la fin de celles qu'elle suit). */
  conflit: boolean;
  /** La tâche fait partie d'une boucle de liens : ses liens sont ignorés. */
  cycle: boolean;
  /** Part faite, de 0 à 100. */
  avancement: number;
  fait: boolean;
  /** Pas faite, et une tâche qu'elle suit ne l'est pas non plus. */
  bloquee: boolean;
};
export type Plan = {
  lignes: Map<string, LignePlan>;
  /** Identifiants dans l'ordre d'affichage. */
  ordre: string[];
  debut: string | null;
  fin: string | null;
  avancement: number;
  nbConflits: number;
  nbCycles: number;
};

const estJalon = (t: Tache) => !!t.jalon || t.duree === 0;
const dureeDe = (t: Tache) => (estJalon(t) ? 0 : Math.max(1, Math.round(t.duree ?? 1)));
const figee = (t: Tache) => !!t.debut && (!!t.fixe || t.statut === 'fait');

type Lien = { de: string; delai: number };
type Graphe = {
  noeuds: Map<string, Noeud>;
  ordre: string[];
  niveaux: Map<string, number>;
  parents: Map<string, string>;
  feuilles: string[];
  estResume: (id: string) => boolean;
  feuillesDe: (id: string) => string[];
  /** Pour chaque feuille, les feuilles à finir avant elle (liens de la tâche et de ses parents, un lien vers un résumé visant ses feuilles). */
  liens: Map<string, Lien[]>;
  suivantes: Map<string, string[]>;
};

function graphe(taches: Tache[]): Graphe {
  const { racines, noeuds } = arbreDe(taches);
  const ordre: string[] = [];
  const niveaux = new Map<string, number>();
  const parents = new Map<string, string>();
  const parcourir = (l: Noeud[], niveau: number, parent?: string) =>
    l.forEach((n) => {
      ordre.push(n.t.id);
      niveaux.set(n.t.id, niveau);
      if (parent) parents.set(n.t.id, parent);
      parcourir(n.enfants, niveau + 1, n.t.id);
    });
  parcourir(racines, 0);
  const estResume = (id: string) => (noeuds.get(id)?.enfants.length ?? 0) > 0;
  const feuillesDe = (id: string): string[] => {
    const n = noeuds.get(id);
    if (!n) return [];
    return n.enfants.length ? n.enfants.flatMap((e) => feuillesDe(e.t.id)) : [id];
  };
  const feuilles = ordre.filter((id) => !estResume(id));
  const liens = new Map<string, Lien[]>();
  for (const id of feuilles) {
    const l = new Map<string, number>();
    for (let c: string | undefined = id, tours = 0; c && tours++ < 200; c = parents.get(c)) {
      const t = noeuds.get(c)!.t;
      for (const a of t.apres ?? []) {
        if (!noeuds.has(a) || a === c) continue;
        for (const f of feuillesDe(a)) if (f !== id) l.set(f, Math.max(l.get(f) ?? 0, Math.max(0, t.delai ?? 0)));
      }
    }
    liens.set(id, [...l].map(([de, delai]) => ({ de, delai })));
  }
  const suivantes = new Map<string, string[]>(feuilles.map((id) => [id, []]));
  for (const id of feuilles) for (const l of liens.get(id)!) suivantes.get(l.de)!.push(id);
  return { noeuds, ordre, niveaux, parents, feuilles, estResume, feuillesDe, liens, suivantes };
}

export function planifier(taches: Tache[], projet: Pick<Projet, 'debut' | 'joursOuvres'>, aujourdhui: string): Plan {
  const ouvres = projet.joursOuvres;
  const { noeuds, ordre, niveaux, feuilles, estResume, feuillesDe, liens, suivantes } = graphe(taches);

  // Ordre topologique ; ce qui n'y entre pas est pris dans une boucle de liens (ou en aval d'une boucle).
  const entrants = new Map(feuilles.map((id) => [id, liens.get(id)!.length]));
  const file = feuilles.filter((id) => entrants.get(id) === 0);
  for (let i = 0; i < file.length; i++)
    for (const s of suivantes.get(file[i])!) {
      entrants.set(s, entrants.get(s)! - 1);
      if (entrants.get(s) === 0) file.push(s);
    }
  const dansOrdre = new Set(file);
  const enBoucle = new Set(feuilles.filter((id) => !dansOrdre.has(id)));
  const sequence = [...file, ...feuilles.filter((id) => enBoucle.has(id))];
  const liensEffectifs = (id: string) => (enBoucle.has(id) ? [] : liens.get(id)!);

  // Départ du planning : celui du projet, sinon la plus ancienne date figée, sinon aujourd'hui.
  const figees = feuilles.map((id) => noeuds.get(id)!.t).filter(figee);
  const departDate = projet.debut ?? (figees.length ? figees.map((t) => t.debut!).sort()[0] : aujourdhui);
  const depart = versPosition(departDate, ouvres, 'debut');

  const debut = new Map<string, number>();
  const fin = new Map<string, number>();
  const conflit = new Set<string>();
  for (const id of sequence) {
    const t = noeuds.get(id)!.t;
    const jalon = estJalon(t);
    // Le plus tôt que les liens permettent : le lendemain de la fin des tâches précédentes, plus l'attente (le jour même pour un jalon).
    let parLiens = -Infinity;
    for (const l of liensEffectifs(id)) parLiens = Math.max(parLiens, fin.get(l.de)! + (jalon ? 0 : 1) + l.delai);
    let d: number;
    let f: number;
    if (figee(t)) {
      d = versPosition(t.debut!, ouvres, 'debut');
      f = jalon ? d : t.echeance ? Math.max(d, versPosition(t.echeance, ouvres, 'fin')) : d + dureeDe(t) - 1;
      if (d < parLiens) conflit.add(id);
    } else {
      d = Math.max(depart, parLiens);
      f = jalon ? d : d + dureeDe(t) - 1;
    }
    debut.set(id, d);
    fin.set(id, f);
  }

  // Marge : on remonte depuis la fin du projet, comme si chaque tâche pouvait glisser.
  const finProjet = feuilles.length ? Math.max(...feuilles.map((id) => fin.get(id)!)) : depart;
  const tardDebut = new Map<string, number>();
  const tardFin = new Map<string, number>();
  for (const id of [...sequence].reverse()) {
    let limite = finProjet;
    for (const s of suivantes.get(id)!) {
      const lien = liensEffectifs(s).find((l) => l.de === id);
      if (lien) limite = Math.min(limite, tardDebut.get(s)! - (estJalon(noeuds.get(s)!.t) ? 0 : 1) - lien.delai);
    }
    tardFin.set(id, limite);
    tardDebut.set(id, limite - (fin.get(id)! - debut.get(id)!));
  }

  const fait = (id: string): boolean => (estResume(id) ? feuillesDe(id).every(fait) : noeuds.get(id)!.t.statut === 'fait');
  const pct = (id: string) => (fait(id) ? 100 : Math.max(0, Math.min(100, Math.round(noeuds.get(id)!.t.avancement ?? 0))));
  const poids = (id: string) => Math.max(1, fin.get(id)! - debut.get(id)! + 1);

  const lignes = new Map<string, LignePlan>();
  for (const id of feuilles) {
    const t = noeuds.get(id)!.t;
    const marge = Math.max(0, tardFin.get(id)! - fin.get(id)!);
    lignes.set(id, {
      id,
      debut: depuisPosition(debut.get(id)!, ouvres),
      fin: depuisPosition(fin.get(id)!, ouvres),
      duree: estJalon(t) ? 0 : fin.get(id)! - debut.get(id)! + 1,
      niveau: niveaux.get(id)!,
      resume: false,
      jalon: estJalon(t),
      marge,
      critique: !enBoucle.has(id) && marge === 0 && (liens.get(id)!.length > 0 || suivantes.get(id)!.length > 0) && !fait(id),
      conflit: conflit.has(id),
      cycle: enBoucle.has(id),
      avancement: pct(id),
      fait: fait(id),
      bloquee: !fait(id) && liensEffectifs(id).some((l) => !fait(l.de)),
    });
  }
  // Résumés, des plus profonds aux plus proches de la racine.
  for (const id of [...ordre].reverse()) {
    if (!estResume(id)) continue;
    const f = feuillesDe(id);
    const deb = Math.min(...f.map((x) => debut.get(x)!));
    const fi = Math.max(...f.map((x) => fin.get(x)!));
    const p = f.reduce((s, x) => s + poids(x), 0);
    const t = noeuds.get(id)!.t;
    lignes.set(id, {
      id,
      debut: depuisPosition(deb, ouvres),
      fin: depuisPosition(fi, ouvres),
      duree: fi - deb + 1,
      niveau: niveaux.get(id)!,
      resume: true,
      jalon: false,
      marge: Math.min(...f.map((x) => lignes.get(x)!.marge)),
      critique: f.some((x) => lignes.get(x)!.critique),
      conflit: f.some((x) => conflit.has(x)),
      cycle: f.some((x) => enBoucle.has(x)),
      avancement: Math.round(f.reduce((s, x) => s + poids(x) * pct(x), 0) / p),
      fait: fait(id),
      bloquee: !fait(id) && (t.apres ?? []).some((a) => noeuds.has(a) && !fait(a)),
    });
  }

  const total = feuilles.reduce((s, id) => s + poids(id), 0);
  return {
    lignes,
    ordre,
    debut: feuilles.length ? depuisPosition(Math.min(...feuilles.map((id) => debut.get(id)!)), ouvres) : null,
    fin: feuilles.length ? depuisPosition(finProjet, ouvres) : null,
    avancement: total ? Math.round(feuilles.reduce((s, id) => s + poids(id) * lignes.get(id)!.avancement, 0) / total) : 0,
    nbConflits: conflit.size,
    nbCycles: enBoucle.size,
  };
}

/**
 * Écrit dans les tâches les dates que le planning vient de calculer (début, échéance) : les rappels, la mission du jour
 * et les listes s'en servent. Les dates figées ne changent pas. Renvoie la même liste s'il n'y a rien à changer.
 */
export function replanifier(toutes: Tache[], projet: Projet, aujourdhui: string): Tache[] {
  const mine = tachesDuProjet(toutes, projet.id);
  if (!mine.length) return toutes;
  const plan = planifier(mine, projet, aujourdhui);
  let change = false;
  const maj = toutes.map((t) => {
    const l = t.projet === projet.id ? plan.lignes.get(t.id) : undefined;
    if (!l) return t;
    if (!l.resume && figee(t)) {
      // Une date figée garde ses dates ; on complète seulement l'échéance qui manquerait.
      if (t.echeance) return t;
      change = true;
      return { ...t, echeance: l.fin };
    }
    if (t.debut === l.debut && t.echeance === l.fin) return t;
    change = true;
    return { ...t, debut: l.debut, echeance: l.fin };
  });
  return change ? maj : toutes;
}

/* ---------- Modifications ---------- */

export type PatchTache = Partial<Omit<Tache, 'id'>>;

/** Prochain rang libre parmi les frères d'une tâche. */
const rangSuivant = (taches: Tache[], projet: string, parent?: string) =>
  taches.filter((t) => t.projet === projet && (t.parent ?? undefined) === parent).reduce((m, t) => Math.max(m, t.ordre ?? 0), -1) + 1;

type NouvelleTache = Pick<Tache, 'id' | 'titre'> & PatchTache & { projet: string };

export function creerTache(taches: Tache[], base: Pick<Tache, 'source' | 'priorite' | 'mode'>, n: NouvelleTache, maintenant = new Date().toISOString()): Tache[] {
  const t: Tache = { statut: 'en_attente', echeance: null, creeLe: maintenant, ...base, ordre: n.ordre ?? rangSuivant(taches, n.projet, n.parent), ...n };
  return [...taches, t];
}

/** Supprime des tâches avec leurs sous-tâches, et les retire des liens des autres. */
export function supprimerTaches(taches: Tache[], ids: string[]): Tache[] {
  const sup = new Set<string>();
  for (const id of ids) for (const d of descendantes(taches, id)) sup.add(d);
  return taches
    .filter((t) => !sup.has(t.id))
    .map((t) => {
      if (!t.apres?.some((a) => sup.has(a))) return t;
      const { apres, ...reste } = t;
      const r = apres!.filter((a) => !sup.has(a));
      return r.length ? { ...reste, apres: r } : reste;
    });
}

/** Ajouter ce lien créerait-il une boucle (la tâche se retrouverait avant elle-même) ? */
export function creeBoucle(taches: Tache[], id: string, apres: string): boolean {
  if (id === apres) return true;
  const t = taches.find((x) => x.id === id);
  if (!t?.projet) return false;
  const g = graphe(tachesDuProjet(taches, t.projet));
  const cibles = new Set(g.feuillesDe(apres));
  const depart = g.feuillesDe(id);
  if (depart.some((f) => cibles.has(f))) return true;
  // Une boucle apparaît si la tâche précède déjà celle qu'on voudrait lui faire précéder.
  const vus = new Set(depart);
  const pile = [...depart];
  while (pile.length) {
    const c = pile.pop()!;
    if (cibles.has(c)) return true;
    for (const s of g.suivantes.get(c) ?? [])
      if (!vus.has(s)) {
        vus.add(s);
        pile.push(s);
      }
  }
  return false;
}

/** Fait suivre `id` après `apres`. Renvoie une erreur lisible si le lien est impossible. */
export function lierApres(taches: Tache[], id: string, apres: string): { taches: Tache[]; erreur?: string } {
  const t = taches.find((x) => x.id === id);
  const a = taches.find((x) => x.id === apres);
  if (!t || !a) return { taches };
  if (t.projet !== a.projet) return { taches, erreur: 'Les deux tâches doivent être dans le même projet.' };
  if (id === apres) return { taches, erreur: 'Une tâche ne peut pas se suivre elle-même.' };
  if (t.apres?.includes(apres)) return { taches };
  if (descendantes(taches, id).has(apres) || descendantes(taches, apres).has(id)) return { taches, erreur: 'Une tâche et ses sous-tâches sont déjà liées par leur parenté.' };
  if (creeBoucle(taches, id, apres)) return { taches, erreur: `« ${a.titre} » suit déjà « ${t.titre} » : ce lien ferait une boucle.` };
  return { taches: taches.map((x) => (x.id === id ? { ...x, apres: [...(x.apres ?? []), apres] } : x)) };
}

export function delierApres(taches: Tache[], id: string, apres: string): Tache[] {
  return taches.map((t) => {
    if (t.id !== id || !t.apres?.includes(apres)) return t;
    const { apres: anciens, ...reste } = t;
    const r = anciens!.filter((a) => a !== apres);
    return r.length ? { ...reste, apres: r } : reste;
  });
}

/** Les tâches auxquelles on peut lier `id` comme « après » : même projet, pas lui-même, pas ses sous-tâches, pas de boucle. */
export function candidatesApres(taches: Tache[], id: string): Tache[] {
  const t = taches.find((x) => x.id === id);
  if (!t?.projet) return [];
  const fils = descendantes(taches, id);
  const pere = new Set<string>();
  for (let c = t.parent; c && !pere.has(c); c = taches.find((x) => x.id === c)?.parent) pere.add(c);
  return ordreAffichage(tachesDuProjet(taches, t.projet))
    .map((x) => x.tache)
    .filter((x) => x.id !== id && !fils.has(x.id) && !pere.has(x.id) && !t.apres?.includes(x.id) && !creeBoucle(taches, id, x.id));
}

/** Met `id` sous un autre parent (ou à la racine), à la fin de ses nouveaux frères. */
export function changerParent(taches: Tache[], id: string, parent: string | null): { taches: Tache[]; erreur?: string } {
  const t = taches.find((x) => x.id === id);
  if (!t) return { taches };
  if (parent && (parent === id || descendantes(taches, id).has(parent))) return { taches, erreur: 'Une tâche ne peut pas être sous-tâche d’elle-même.' };
  const p = parent ? taches.find((x) => x.id === parent) : undefined;
  if (parent && (!p || p.projet !== t.projet)) return { taches };
  const rang = rangSuivant(taches, t.projet ?? '', parent ?? undefined);
  return {
    taches: taches.map((x) => {
      if (x.id !== id) return x;
      const { parent: _ancien, ...reste } = x;
      void _ancien;
      return parent ? { ...reste, parent, ordre: rang } : { ...reste, ordre: rang };
    }),
  };
}

/** Monte (-1) ou descend (+1) une tâche parmi ses frères. */
export function deplacerTache(taches: Tache[], id: string, delta: -1 | 1): Tache[] {
  const t = taches.find((x) => x.id === id);
  if (!t?.projet) return taches;
  const freres = ordreAffichage(tachesDuProjet(taches, t.projet)).map((x) => x.tache).filter((x) => (x.parent ?? undefined) === (t.parent ?? undefined));
  const i = freres.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= freres.length) return taches;
  const ordre = new Map(freres.map((x, k) => [x.id, k]));
  ordre.set(freres[i].id, j);
  ordre.set(freres[j].id, i);
  return taches.map((x) => (ordre.has(x.id) && (x.parent ?? undefined) === (t.parent ?? undefined) && x.projet === t.projet ? { ...x, ordre: ordre.get(x.id)! } : x));
}

/** Rend la tâche sous-tâche de celle qui la précède parmi ses frères (comme un retrait dans Excel). */
export function indenter(taches: Tache[], id: string): Tache[] {
  const t = taches.find((x) => x.id === id);
  if (!t?.projet) return taches;
  const freres = ordreAffichage(tachesDuProjet(taches, t.projet)).map((x) => x.tache).filter((x) => (x.parent ?? undefined) === (t.parent ?? undefined));
  const i = freres.findIndex((x) => x.id === id);
  return i > 0 ? changerParent(taches, id, freres[i - 1].id).taches : taches;
}
/** Remonte la tâche d'un niveau : elle devient la sœur de son parent, juste après lui. */
export function desindenter(taches: Tache[], id: string): Tache[] {
  const t = taches.find((x) => x.id === id);
  const p = t?.parent ? taches.find((x) => x.id === t.parent) : undefined;
  if (!t || !p || !t.projet) return taches;
  const freres = ordreAffichage(tachesDuProjet(taches, t.projet)).map((x) => x.tache).filter((x) => (x.parent ?? undefined) === (p.parent ?? undefined));
  const rang = new Map(freres.map((x, k) => [x.id, k * 2]));
  return taches.map((x) => {
    if (x.id !== id) return rang.has(x.id) ? { ...x, ordre: rang.get(x.id)! } : x;
    const { parent: _ancien, ...reste } = x;
    void _ancien;
    return { ...reste, ...(p.parent ? { parent: p.parent } : {}), ordre: (rang.get(p.id) ?? 0) + 1 };
  });
}

/**
 * Décale une tâche de n jours : ses dates sont figées à leur nouvelle valeur, et celles qui la suivent se recalculent.
 * Une tâche résumé décale toutes ses sous-tâches.
 */
export function decalerTache(taches: Tache[], projet: Projet, id: string, n: number, aujourdhui: string): Tache[] {
  const mine = tachesDuProjet(taches, projet.id);
  const plan = planifier(mine, projet, aujourdhui);
  const cibles = [...descendantes(mine, id)].filter((x) => !plan.lignes.get(x)?.resume);
  const decalees = taches.map((t) => {
    if (!cibles.includes(t.id)) return t;
    const l = plan.lignes.get(t.id)!;
    const debut = decalerDate(l.debut, n, projet.joursOuvres);
    return { ...t, debut, echeance: l.jalon ? debut : finDepuis(debut, l.duree, projet.joursOuvres), fixe: true };
  });
  return replanifier(decalees, projet, aujourdhui);
}

/* ---------- Sous-tâches générées ---------- */

export const MODELES_ETAPES: { cle: string; nom: string; etapes: string[] }[] = [
  { cle: 'simple', nom: 'Préparer, faire, vérifier', etapes: ['Préparer', 'Réaliser', 'Vérifier', 'Livrer'] },
  { cle: 'projet', nom: 'Cadrer, concevoir, réaliser, tester', etapes: ['Cadrer', 'Concevoir', 'Réaliser', 'Tester', 'Livrer'] },
  { cle: 'decision', nom: 'Informer, décider, agir', etapes: ['Rassembler les informations', 'Décider', 'Agir', 'Confirmer le résultat'] },
  { cle: 'evenement', nom: 'Organiser un événement', etapes: ['Fixer la date et le lieu', 'Inviter', 'Préparer le matériel', 'Le jour J', 'Faire le bilan'] },
];

/** Étapes saisies à la main : une par ligne ou séparées par « ; », puces et numéros retirés. */
export function etapesDepuisTexte(texte: string): string[] {
  return texte
    .split(/\r?\n|;/)
    .map((l) => l.replace(/^\s*(?:[-–—•*·▪]+|\d+\s*[.)\]-]|[a-z]\))\s*/i, '').trim())
    .filter(Boolean)
    .slice(0, 40);
}

export type OptionsGeneration = {
  /** Chaque étape commence quand la précédente finit. */
  enchainer: boolean;
  /** Partage la durée de la tâche entre les étapes (au moins 1 jour chacune). */
  repartir: boolean;
};

/**
 * Découpe une tâche en sous-tâches. Elle devient un résumé : ses dates viennent de ses étapes. Ses liens « après » restent sur elle
 * et valent pour toutes les étapes. Si ses dates étaient figées, la première étape reprend son début.
 */
export function genererSousTaches(taches: Tache[], projet: Projet, parentId: string, etapes: string[], opts: OptionsGeneration, nouvelId: () => string, aujourdhui: string): Tache[] {
  const parent = taches.find((t) => t.id === parentId);
  const noms = etapes.map((e) => e.trim()).filter(Boolean);
  if (!parent || !noms.length) return taches;
  const plan = planifier(tachesDuProjet(taches, projet.id), projet, aujourdhui);
  const ligne = plan.lignes.get(parentId);
  const total = parent.duree && parent.duree > 0 ? parent.duree : ligne && !ligne.resume ? ligne.duree : noms.length;
  const base = Math.floor(total / noms.length);
  const surplus = total % noms.length;
  const ids = noms.map(() => nouvelId());
  const rang0 = rangSuivant(taches, projet.id, parentId);
  const enfants: Tache[] = noms.map((titre, k) => ({
    id: ids[k],
    titre,
    source: parent.source,
    priorite: parent.priorite,
    echeance: null,
    statut: 'en_attente',
    mode: parent.mode,
    creeLe: new Date().toISOString(),
    ...(parent.categories?.length ? { categories: parent.categories } : {}),
    ...(parent.responsable ? { responsable: parent.responsable } : {}),
    projet: projet.id,
    parent: parentId,
    ordre: rang0 + k,
    duree: opts.repartir ? Math.max(1, base + (k < surplus ? 1 : 0)) : 1,
    ...(opts.enchainer && k > 0 ? { apres: [ids[k - 1]] } : {}),
    ...(k === 0 && parent.fixe && parent.debut ? { debut: parent.debut, fixe: true } : {}),
  }));
  const parentMaj = taches.map((t) => {
    if (t.id !== parentId) return t;
    const { fixe: _f, duree: _d, ...reste } = t;
    void _f;
    void _d;
    return reste;
  });
  return replanifier([...parentMaj, ...enfants], projet, aujourdhui);
}

/* ---------- Suivi ---------- */

/** Les prochaines tâches à faire : débloquées (aucune tâche précédente en attente), dans l'ordre du planning. */
export function prochainesTaches(taches: Tache[], projet: Projet, aujourdhui: string, n = 3): { tache: Tache; ligne: LignePlan }[] {
  const mine = tachesDuProjet(taches, projet.id);
  const plan = planifier(mine, projet, aujourdhui);
  return mine
    .filter((t) => { const l = plan.lignes.get(t.id); return !!l && !l.resume && !l.fait && !l.bloquee; })
    .map((t) => ({ tache: t, ligne: plan.lignes.get(t.id)! }))
    .sort((a, b) => a.ligne.debut.localeCompare(b.ligne.debut) || (a.tache.ordre ?? 0) - (b.tache.ordre ?? 0))
    .slice(0, n);
}

export type EtatProjet = {
  plan: Plan;
  nbTaches: number;
  nbFaites: number;
  enRetard: number;
  /** Fin prévue du projet, et jours de retard par rapport à la date limite voulue. */
  fin: string | null;
};
export function etatProjet(taches: Tache[], projet: Projet, aujourdhui: string): EtatProjet {
  const mine = tachesDuProjet(taches, projet.id);
  const plan = planifier(mine, projet, aujourdhui);
  const feuilles = [...plan.lignes.values()].filter((l) => !l.resume);
  return {
    plan,
    nbTaches: feuilles.length,
    nbFaites: feuilles.filter((l) => l.fait).length,
    enRetard: feuilles.filter((l) => !l.fait && l.fin < aujourdhui).length,
    fin: plan.fin,
  };
}

/**
 * Les tâches qui comptent pour la mission du jour, les rappels et les compteurs : toutes les tâches simples, et dans un projet seulement les
 * tâches (jamais les résumés) pas faites et pas bloquées. Un plan de deux cents lignes ne doit pas noyer le reste.
 * Les tâches faites ne sont jamais ici : la mission du jour garde aussi celles terminées aujourd'hui, elle les prend dans `taches`.
 */
export function tachesActives(e: { taches: Tache[]; projets?: Projet[] }, aujourdhui: string): Tache[] {
  const enProjet = e.taches.filter((t) => t.projet && e.projets?.some((p) => p.id === t.projet));
  if (!enProjet.length) return e.taches.filter((t) => t.statut !== 'fait');
  const bloquees = new Set<string>();
  for (const p of e.projets!) {
    const mine = tachesDuProjet(e.taches, p.id);
    if (!mine.length) continue;
    for (const [id, l] of planifier(mine, p, aujourdhui).lignes) if (l.bloquee) bloquees.add(id);
  }
  const parents = resumes(e.taches);
  return e.taches.filter((t) => t.statut !== 'fait' && !parents.has(t.id) && !bloquees.has(t.id));
}

/** Une tâche de projet ne se rappelle et ne compte « urgente » que par son échéance, jamais par sa priorité. */
export const estTacheDeProjet = (t: Pick<Tache, 'projet'>, projets?: Projet[]) => !!t.projet && !!projets?.some((p) => p.id === t.projet);

/** Les tâches à signaler aujourd'hui : priorité haute ou échéance proche pour une tâche simple, échéance proche seule pour une tâche de projet. */
export function tachesUrgentes(e: { taches: Tache[]; projets?: Projet[] }, aujourdhui: string, bientot: string): Tache[] {
  return tachesActives(e, aujourdhui).filter((t) => {
    const proche = !!t.echeance && t.echeance <= bientot;
    return estTacheDeProjet(t, e.projets) ? proche : t.priorite === 'haute' || proche;
  });
}
