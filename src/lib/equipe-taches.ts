import { addDays } from './dates';
import { membreDe, nomMembre } from './affectation';
import type { MembreEquipe } from './equipes';
import { resumes } from './planning';
import type { Priorite, Tache } from './types';

/**
 * Les tâches vues par personne, dans l'espace d'une équipe : qui est responsable de quoi, ce que chacun a à faire et pour
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

export type GroupeMembre = {
  /** `m:<id>` d'un membre, `ext:<nom>` d'un responsable hors équipe, `non` pour les tâches sans responsable. */
  cle: string;
  nom: string;
  membre: MembreEquipe | null;
  moi: boolean;
  /** Les tâches à faire de la période (et celles en retard), par échéance. */
  ouvertes: Tache[];
  /** Les tâches sans échéance, qui n'entrent dans aucune période. */
  sansEcheance: Tache[];
  enRetard: number;
  /** Échéance dans les sept jours qui viennent, aujourd'hui compris. */
  cetteSemaine: number;
  faites: number;
  /** La plus proche échéance à venir (ou la plus ancienne en retard). */
  prochaine: string | null;
};

/**
 * Le travail de chacun : chaque membre (même sans tâche), puis les responsables hors équipe, puis « Non affectées ».
 * Moi d'abord, les autres par nom. Les tâches « résumé » d'un projet (celles qui regroupent des sous-tâches) ne comptent pas.
 * `jusqua` limite aux tâches dues avant ce jour (le retard reste toujours) ; sans lui, toutes les tâches à faire.
 */
export function parMembre(taches: Tache[], membres: MembreEquipe[], moiId: string | undefined, aujourdhui: string, jusqua?: string): GroupeMembre[] {
  const parents = resumes(taches);
  const vraies = taches.filter((t) => !parents.has(t.id));
  const semaine = addDays(aujourdhui, 6);
  const groupes = new Map<string, GroupeMembre>();
  const vide = (cle: string, nom: string, membre: MembreEquipe | null, moi: boolean): GroupeMembre => ({ cle, nom, membre, moi, ouvertes: [], sansEcheance: [], enRetard: 0, cetteSemaine: 0, faites: 0, prochaine: null });
  for (const m of membres) groupes.set(`m:${m.id}`, vide(`m:${m.id}`, nomMembre(m), m, m.id === moiId));

  for (const t of vraies) {
    const r = responsableDe(t, membres, moiId);
    const cle = r?.membre ? `m:${r.membre.id}` : r ? `ext:${r.nom.toLowerCase()}` : 'non';
    const g = groupes.get(cle) ?? groupes.set(cle, vide(cle, r?.nom ?? 'Non affectées', null, false)).get(cle)!;
    if (t.statut === 'fait') {
      g.faites++;
      continue;
    }
    const retard = !!t.echeance && t.echeance < aujourdhui;
    if (retard) g.enRetard++;
    if (t.echeance && t.echeance >= aujourdhui && t.echeance <= semaine) g.cetteSemaine++;
    if (!t.echeance) g.sansEcheance.push(t);
    else if (retard || !jusqua || t.echeance <= jusqua) g.ouvertes.push(t);
  }
  for (const g of groupes.values()) {
    g.ouvertes.sort(parEcheance);
    g.sansEcheance.sort(parEcheance);
    // La prochaine échéance à venir ; à défaut, la plus ancienne en retard.
    g.prochaine = g.ouvertes.find((t) => t.echeance! >= aujourdhui)?.echeance ?? g.ouvertes[0]?.echeance ?? null;
  }
  const rang = (g: GroupeMembre) => (g.moi ? 0 : g.membre ? 1 : g.cle === 'non' ? 3 : 2);
  return [...groupes.values()].filter((g) => g.membre || g.ouvertes.length || g.sansEcheance.length || g.faites).sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, 'fr'));
}

/** Ce que dit le filtre, en clair (« Les tâches de Paul »). */
export function libelleFiltre(filtre: FiltreMembre, membres: MembreEquipe[]): string {
  if (filtre === 'tous') return 'Toute l’équipe';
  if (filtre === 'moi') return 'Mes tâches';
  if (filtre === 'non') return 'Tâches non affectées';
  const m = membres.find((x) => x.id === filtre.slice(2));
  return m ? `Tâches de ${nomMembre(m)}` : 'Membre';
}

/** Combien de tâches à faire par filtre, pour les compteurs des puces. */
export function comptesParFiltre(taches: Tache[], membres: MembreEquipe[], moiId?: string): Map<FiltreMembre, number> {
  const parents = resumes(taches);
  const n = new Map<FiltreMembre, number>([['tous', 0], ['moi', 0], ['non', 0]]);
  for (const m of membres) n.set(filtreDeMembre(m.id), 0);
  for (const t of taches) {
    if (parents.has(t.id) || t.statut === 'fait') continue;
    n.set('tous', n.get('tous')! + 1);
    const r = responsableDe(t, membres, moiId);
    const cles: FiltreMembre[] = r ? [...(r.moi ? (['moi'] as const) : []), ...(r.membre ? [filtreDeMembre(r.membre.id)] : [])] : ['non'];
    for (const c of cles) n.set(c, (n.get(c) ?? 0) + 1);
  }
  return n;
}
