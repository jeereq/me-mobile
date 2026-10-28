import { addDays } from './dates';
import { membreDe, nomMembre } from './affectation';
import type { MembreEquipe } from './equipes';
import { resumes } from './planning';
import type { Espace, Priorite, Tache } from './types';

/**
 * Ce qui est confié à chacun, dans l'espace d'une équipe : tâches, relances et rendez-vous. Qui est responsable de quoi, ce que chacun a à faire et pour
 * quand, et les filtres « moi », « Paul », « non affectées ». Pur, sans l'app : il se teste avec `npm test`.
 *
 * Le responsable d'une tâche est le membre à qui elle est confiée (`affecteA`), ou, pour une tâche plus ancienne, le membre
 * dont le nom est écrit dans `responsable`. Un nom qui n'est celui d'aucun membre reste un responsable « externe ».
 */

type Qui = Pick<Tache, 'affecteA' | 'responsable'>;

export type Responsable = {
  nom: string;
  /** Le membre de l'équipe, s'il en est un. */
  membre: MembreEquipe | null;
  moi: boolean;
  /** La tâche avait été confiée à un compte qui n'est plus dans l'équipe : son nom reste, sans membre. */
  parti: boolean;
};

/** Qui s'occupe de la tâche, ou null si personne. */
export function responsableDe(t: Qui, membres: MembreEquipe[], moiId?: string): Responsable | null {
  const membre = membreDe(membres, t);
  if (membre) return { nom: nomMembre(membre), membre, moi: membre.id === moiId, parti: false };
  const nom = t.responsable?.trim();
  return nom ? { nom, membre: null, moi: false, parti: !!t.affecteA } : null;
}

/** Les choix du filtre : tout le monde, moi, personne, ou un membre (`m:<id>`). */
export type FiltreMembre = 'tous' | 'moi' | 'non' | `m:${string}`;
export const filtreDeMembre = (id: string): FiltreMembre => `m:${id}`;

/** La tâche entre-t-elle dans ce filtre ? */
export function estDeMembre(t: Qui, filtre: FiltreMembre, membres: MembreEquipe[], moiId?: string): boolean {
  if (filtre === 'tous') return true;
  const r = responsableDe(t, membres, moiId);
  if (filtre === 'non') return !r;
  if (filtre === 'moi') return !!r?.moi;
  return !!r?.membre && r.membre.id === filtre.slice(2);
}

/** Les initiales d'un nom (« Paul Dubois » → « PD »), ou les deux premières lettres d'une adresse. */
export function initiales(nom: string): string {
  const mots = nom.trim().replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  if (!mots.length) return '?';
  const lettres = mots.length > 1 ? mots[0][0] + mots[1][0] : mots[0].slice(0, 2);
  return lettres.toUpperCase();
}

const RANG_PRIORITE: Record<Priorite, number> = { haute: 0, moyenne: 1, basse: 2 };
/** Par échéance (sans échéance à la fin), puis la plus urgente, puis par titre. */
export const parEcheance = (a: Tache, b: Tache) => (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999') || RANG_PRIORITE[a.priorite] - RANG_PRIORITE[b.priorite] || a.titre.localeCompare(b.titre, 'fr');

export type GenreElement = 'tache' | 'relance' | 'rdv';
export const GENRES_ELEMENT: GenreElement[] = ['rdv', 'tache', 'relance'];
export const NOM_GENRE: Record<GenreElement, { un: string; plus: string }> = { tache: { un: 'tâche', plus: 'tâches' }, relance: { un: 'relance', plus: 'relances' }, rdv: { un: 'rendez-vous', plus: 'rendez-vous' } };

/** Ce qui peut être confié à quelqu'un, vu de la même façon : une tâche, une relance ou un rendez-vous, avec son jour. */
export type ElementPlan = {
  /** Unique dans la liste (`tache:<id>`). */
  cle: string;
  genre: GenreElement;
  id: string;
  titre: string;
  /** Échéance de la tâche, jour de la relance ou du rendez-vous ; null sans échéance. */
  date: string | null;
  /** « HH:MM » d'un rendez-vous. */
  heure?: string;
  detail?: string;
  /** Tâche terminée ou relance obtenue. */
  fait: boolean;
  affecteA?: string;
  responsable?: string;
  priorite?: Priorite;
  projet?: string;
};

const HEURE = /^\d{1,2}:\d{2}$/;

/** Les tâches comme éléments ; les tâches « résumé » d'un projet (qui regroupent des sous-tâches) n'y sont pas. */
export function elementsDeTaches(taches: Tache[]): ElementPlan[] {
  const parents = resumes(taches);
  return taches
    .filter((t) => !parents.has(t.id))
    .map((t) => ({ cle: `tache:${t.id}`, genre: 'tache' as const, id: t.id, titre: t.titre, date: t.echeance, fait: t.statut === 'fait', affecteA: t.affecteA, responsable: t.responsable, priorite: t.priorite, projet: t.projet }));
}

/**
 * Tout ce qui se confie : les tâches, les relances (à leur jour) et les rendez-vous d'aujourd'hui et à venir. Un rendez-vous
 * sans identifiant (importé d'un agenda) ne peut pas être suivi ni confié : il n'en fait pas partie.
 */
export function elementsDePlan(e: Pick<Espace, 'taches' | 'relances'> & Partial<Pick<Espace, 'agenda'>>, aujourdhui: string): ElementPlan[] {
  const relances: ElementPlan[] = (e.relances ?? []).map((r) => ({ cle: `relance:${r.id}`, genre: 'relance', id: r.id, titre: `Relancer ${r.contact}`, detail: r.sujet || undefined, date: r.date || null, fait: r.statut === 'repondu', affecteA: r.affecteA, responsable: r.responsable }));
  const rdv: ElementPlan[] = [];
  for (const [jour, evs] of Object.entries(e.agenda ?? {}))
    if (jour >= aujourdhui)
      for (const ev of evs) if (ev.id) rdv.push({ cle: `rdv:${ev.id}`, genre: 'rdv', id: ev.id, titre: ev.titre, detail: ev.lieu || undefined, date: jour, heure: HEURE.test(ev.debut) ? ev.debut : undefined, fait: false, affecteA: ev.affecteA, responsable: ev.responsable });
  return [...elementsDeTaches(e.taches), ...relances, ...rdv];
}

/** Par jour (sans jour à la fin), puis par heure, puis rendez-vous, tâches, relances, enfin la plus urgente et le titre. */
export const parJourElement = (a: ElementPlan, b: ElementPlan) =>
  (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
  (a.heure ?? '99').localeCompare(b.heure ?? '99') ||
  GENRES_ELEMENT.indexOf(a.genre) - GENRES_ELEMENT.indexOf(b.genre) ||
  RANG_PRIORITE[a.priorite ?? 'moyenne'] - RANG_PRIORITE[b.priorite ?? 'moyenne'] ||
  a.titre.localeCompare(b.titre, 'fr');

export type GroupeMembre = {
  /** `m:<id>` d'un membre, `ext:<nom>` d'un responsable hors équipe, `non` pour ce qui n'a pas de responsable. */
  cle: string;
  nom: string;
  membre: MembreEquipe | null;
  moi: boolean;
  /** Ce qui est à faire sur la période (et ce qui est en retard), par jour. */
  ouvertes: ElementPlan[];
  /** Ce qui est à faire sans échéance, qui n'entre dans aucune période. */
  sansEcheance: ElementPlan[];
  /** Combien de tâches, relances et rendez-vous à faire, toutes périodes confondues. */
  parGenre: Record<GenreElement, number>;
  enRetard: number;
  /** Échéance dans les sept jours qui viennent, aujourd'hui compris. */
  cetteSemaine: number;
  faites: number;
  /** Le plus proche jour à venir (ou le plus ancien en retard). */
  prochaine: string | null;
};

/**
 * Le travail de chacun : chaque membre (même sans rien), puis les responsables hors équipe, puis « Non affectées ».
 * Moi d'abord, les autres par nom. `jusqua` limite aux éléments dus avant ce jour (le retard reste toujours) ; sans lui,
 * tout ce qui est à faire.
 */
export function parMembre(elements: ElementPlan[], membres: MembreEquipe[], moiId: string | undefined, aujourdhui: string, jusqua?: string): GroupeMembre[] {
  const semaine = addDays(aujourdhui, 6);
  const groupes = new Map<string, GroupeMembre>();
  const vide = (cle: string, nom: string, membre: MembreEquipe | null, moi: boolean): GroupeMembre => ({ cle, nom, membre, moi, ouvertes: [], sansEcheance: [], parGenre: { tache: 0, relance: 0, rdv: 0 }, enRetard: 0, cetteSemaine: 0, faites: 0, prochaine: null });
  for (const m of membres) groupes.set(`m:${m.id}`, vide(`m:${m.id}`, nomMembre(m), m, m.id === moiId));

  for (const x of elements) {
    const r = responsableDe(x, membres, moiId);
    const cle = r?.membre ? `m:${r.membre.id}` : r ? `ext:${r.nom.toLowerCase()}` : 'non';
    const g = groupes.get(cle) ?? groupes.set(cle, vide(cle, r?.nom ?? 'Non affectées', null, false)).get(cle)!;
    if (x.fait) {
      g.faites++;
      continue;
    }
    g.parGenre[x.genre]++;
    const retard = !!x.date && x.date < aujourdhui;
    if (retard) g.enRetard++;
    if (x.date && x.date >= aujourdhui && x.date <= semaine) g.cetteSemaine++;
    if (!x.date) g.sansEcheance.push(x);
    else if (retard || !jusqua || x.date <= jusqua) g.ouvertes.push(x);
  }
  for (const g of groupes.values()) {
    g.ouvertes.sort(parJourElement);
    g.sansEcheance.sort(parJourElement);
    // Le prochain jour à venir ; à défaut, le plus ancien en retard.
    g.prochaine = g.ouvertes.find((x) => x.date! >= aujourdhui)?.date ?? g.ouvertes[0]?.date ?? null;
  }
  const rang = (g: GroupeMembre) => (g.moi ? 0 : g.membre ? 1 : g.cle === 'non' ? 3 : 2);
  return [...groupes.values()].filter((g) => g.membre || g.ouvertes.length || g.sansEcheance.length || g.faites).sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, 'fr'));
}

/** Ce que dit le filtre, en clair (« Ce qui est à Paul »). */
export function libelleFiltre(filtre: FiltreMembre, membres: MembreEquipe[], genre: GenreElement | 'tout' = 'tache'): string {
  const quoi = genre === 'tout' ? 'Tout' : NOM_GENRE[genre].plus.replace(/^./, (c) => c.toUpperCase());
  if (filtre === 'tous') return genre === 'tout' ? 'Toute l’équipe' : genre === 'tache' ? 'Toutes les tâches' : `Toutes les ${NOM_GENRE[genre].plus}`;
  if (filtre === 'moi') return genre === 'tout' ? 'Ce qui est à moi' : `Mes ${NOM_GENRE[genre].plus}`;
  if (filtre === 'non') return genre === 'tout' ? 'Non affectés' : `${quoi} non affecté${genre === 'rdv' ? 's' : 'es'}`;
  const m = membres.find((x) => x.id === filtre.slice(2));
  return m ? (genre === 'tout' ? `Ce qui est à ${nomMembre(m)}` : `${quoi} de ${nomMembre(m)}`) : 'Membre';
}

/** Combien d'éléments à faire par filtre, pour les compteurs des puces. */
export function comptesParFiltre(elements: ElementPlan[], membres: MembreEquipe[], moiId?: string): Map<FiltreMembre, number> {
  const n = new Map<FiltreMembre, number>([['tous', 0], ['moi', 0], ['non', 0]]);
  for (const m of membres) n.set(filtreDeMembre(m.id), 0);
  for (const x of elements) {
    if (x.fait) continue;
    n.set('tous', n.get('tous')! + 1);
    const r = responsableDe(x, membres, moiId);
    const cles: FiltreMembre[] = r ? [...(r.moi ? (['moi'] as const) : []), ...(r.membre ? [filtreDeMembre(r.membre.id)] : [])] : ['non'];
    for (const c of cles) n.set(c, (n.get(c) ?? 0) + 1);
  }
  return n;
}

/** À qui confier par défaut ce que je crée dans l'espace d'une équipe : à moi, pour que rien ne reste sans propriétaire. */
export function proprietaireParDefaut(membres: MembreEquipe[], moiId?: string): { affecteA?: string; responsable?: string } {
  const moi = moiId ? membres.find((m) => m.id === moiId) : undefined;
  return moi ? { affecteA: moi.id, responsable: nomMembre(moi) } : {};
}
