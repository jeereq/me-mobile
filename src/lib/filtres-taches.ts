import { addDays } from './dates';
import { nomMembre } from './affectation';
import { nomEtat } from './etats-tache';
import type { MembreEquipe } from './equipes';
import { estDeMembre, type FiltreMembre } from './equipe-taches';
import { nomPilier, type Pilier } from './piliers';
import type { Plan } from './planning';
import type { EtatTache, Tache } from './types';

/**
 * Les filtres des tâches et du planning d'un projet : un seul jeu de critères pour la liste et le diagramme.
 * Pur, sans l'app : il se teste avec `npm test`.
 */

export type StatutFiltre = 'toutes' | 'afaire' | 'retard' | 'critique' | 'jalons' | 'faites';
/** Ce qui est en cours dans les N prochains jours (« 7 », « 30 », « 90 »), ou tout. */
export type PeriodeFiltre = 'toutes' | '7' | '30' | '90';
export type Criteres = {
  statut: StatutFiltre;
  recherche: string;
  membre: FiltreMembre;
  /** Un état précis, `normal` (aucun état posé) ou `tous`. */
  etat: EtatTache | 'normal' | 'tous';
  /** Un pilier du groupe (1 à 10), ou null. */
  pilier: number | null;
  periode: PeriodeFiltre;
};

export const CRITERES_VIDES: Criteres = { statut: 'toutes', recherche: '', membre: 'tous', etat: 'tous', pilier: null, periode: 'toutes' };

const normaliser = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Combien de critères sont posés (le statut compte aussi). */
export const nbCriteres = (c: Criteres) => [c.statut !== 'toutes', !!c.recherche.trim(), c.membre !== 'tous', c.etat !== 'tous', c.pilier !== null, c.periode !== 'toutes'].filter(Boolean).length;
/** Combien de critères autres que le statut, ceux qu'on range sous « Plus de filtres ». */
export const nbCriteresPlus = (c: Criteres) => nbCriteres(c) - (c.statut !== 'toutes' ? 1 : 0) - (c.recherche.trim() ? 1 : 0);

type Contexte = { aujourdhui: string; membres: MembreEquipe[]; moiId?: string };

function accepte(t: Tache, plan: Plan, c: Criteres, x: Contexte): boolean {
  const l = plan.lignes.get(t.id);
  if (!l) return false;
  if (c.statut === 'afaire' && l.fait) return false;
  if (c.statut === 'faites' && !l.fait) return false;
  if (c.statut === 'retard' && (l.fait || l.fin >= x.aujourdhui)) return false;
  if (c.statut === 'critique' && (l.fait || !l.critique)) return false;
  if (c.statut === 'jalons' && !l.jalon) return false;
  const q = normaliser(c.recherche.trim());
  if (q && !normaliser(`${t.titre} ${t.note ?? ''} ${t.responsable ?? ''}`).includes(q)) return false;
  if (c.membre !== 'tous' && !estDeMembre(t, c.membre, x.membres, x.moiId)) return false;
  if (c.etat === 'normal' ? !!t.etat : c.etat !== 'tous' && t.etat !== c.etat) return false;
  if (c.pilier !== null && !t.pilier?.includes(c.pilier)) return false;
  if (c.periode !== 'toutes' && (l.fin < x.aujourdhui || l.debut > addDays(x.aujourdhui, Number(c.periode) - 1))) return false;
  return true;
}

/**
 * Les tâches à montrer, ou null quand aucun critère n'est posé (tout se montre). Une tâche « résumé » (qui regroupe des
 * sous-tâches) se montre dès qu'une de ses sous-tâches passe, pour garder l'arborescence lisible.
 */
export function tachesVisibles(taches: Tache[], plan: Plan, c: Criteres, x: Contexte): Set<string> | null {
  if (!nbCriteres(c)) return null;
  const parents = new Map(taches.map((t) => [t.id, t.parent]));
  const visibles = new Set<string>();
  for (const t of taches) {
    const l = plan.lignes.get(t.id);
    if (!l || l.resume || !accepte(t, plan, c, x)) continue;
    visibles.add(t.id);
    for (let p = parents.get(t.id), n = 0; p && n < 50; p = parents.get(p), n++) visibles.add(p);
  }
  return visibles;
}

/** Les piliers que citent les tâches, dans l'ordre. */
export const piliersDesTaches = (taches: Tache[]): number[] => [...new Set(taches.flatMap((t) => t.pilier ?? []))].sort((a, b) => a - b);

const NOM_STATUT: Record<StatutFiltre, string> = { toutes: 'Toutes', afaire: 'À faire', retard: 'En retard', critique: 'Critiques', jalons: 'Jalons', faites: 'Faites' };
export const nomStatut = (s: StatutFiltre) => NOM_STATUT[s];

export type EtiquetteCritere = { cle: keyof Criteres; label: string };

/** Les critères posés, un par étiquette qu'on peut retirer d'un geste. */
export function etiquettesCriteres(c: Criteres, membres: MembreEquipe[], piliers?: Pilier[]): EtiquetteCritere[] {
  const sortie: EtiquetteCritere[] = [];
  if (c.statut !== 'toutes') sortie.push({ cle: 'statut', label: NOM_STATUT[c.statut] });
  if (c.recherche.trim()) sortie.push({ cle: 'recherche', label: `« ${c.recherche.trim()} »` });
  if (c.periode !== 'toutes') sortie.push({ cle: 'periode', label: `${c.periode} jours` });
  if (c.etat !== 'tous') sortie.push({ cle: 'etat', label: c.etat === 'normal' ? 'Normal' : nomEtat(c.etat) });
  if (c.pilier !== null) sortie.push({ cle: 'pilier', label: nomPilier(c.pilier, piliers) });
  if (c.membre !== 'tous') {
    const m = c.membre.startsWith('m:') ? membres.find((x) => x.id === c.membre.slice(2)) : undefined;
    sortie.push({ cle: 'membre', label: c.membre === 'moi' ? 'Moi' : c.membre === 'non' ? 'Non affecté' : c.membre === 'suivi' ? 'Que je suis' : m ? nomMembre(m) : 'Membre' });
  }
  return sortie;
}

/** Les critères sans celui-ci : l'étiquette retirée. */
export const sansCritere = (c: Criteres, cle: keyof Criteres): Criteres => ({ ...c, [cle]: CRITERES_VIDES[cle] });
