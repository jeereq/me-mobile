import type { MembreEquipe } from './equipes';
import type { Tache } from './types';

/**
 * Confier une tâche à un membre de l'équipe, ou lui écrire à son sujet.
 *
 * Une tâche porte `affecteA` (le compte du membre) et `responsable` (son nom, pour l'affichage et pour les tâches plus
 * anciennes, qui n'avaient que le nom). Le serveur prévient le membre quand `affecteA` apparaît ou change.
 * Ce fichier n'importe que des types : il se teste avec `npm test`, sans l'app.
 */

export const nomMembre = (m: Pick<MembreEquipe, 'nom' | 'email'>) => m.nom || m.email;

/** Le membre à qui la tâche est confiée : par son compte, sinon (tâche plus ancienne) par le nom écrit dans « responsable ». */
export function membreDe(membres: MembreEquipe[], t: Pick<Tache, 'affecteA' | 'responsable'>): MembreEquipe | null {
  if (t.affecteA) return membres.find((m) => m.id === t.affecteA) ?? null;
  const r = t.responsable?.trim().toLowerCase();
  return r ? (membres.find((m) => nomMembre(m).toLowerCase() === r) ?? null) : null;
}

/**
 * Ce que change dans la tâche le choix d'un membre (ou « Personne » avec `null`). Retirer quelqu'un n'efface pas un
 * responsable écrit à la main qui n'est pas un membre. Les clés à `undefined` sont des clés à retirer.
 */
export function patchAffectation(membres: MembreEquipe[], t: Pick<Tache, 'affecteA' | 'responsable'>, choisi: MembreEquipe | null): { affecteA?: string; responsable?: string } {
  if (choisi) return { affecteA: choisi.id, responsable: nomMembre(choisi) };
  return { affecteA: undefined, responsable: membreDe(membres, t) ? undefined : t.responsable };
}

const dateFr = (d: string) => d.split('-').reverse().join('/');

/** Le brouillon du mail « à propos de cette tâche » : au membre à qui elle est confiée s'il y en a un, sinon l'adresse est à écrire. */
export function brouillonMailTache(t: Pick<Tache, 'titre' | 'echeance' | 'note'>, membre: MembreEquipe | null) {
  const prenom = membre ? (membre.nom || '').trim().split(/\s+/)[0] : '';
  const quand = t.echeance ? ` (à faire pour le ${dateFr(t.echeance)})` : '';
  const note = t.note?.trim() ? `\n\n${t.note.trim()}` : '';
  return {
    ...(membre ? { a: membre.email } : {}),
    sujet: `Tâche : ${t.titre}`,
    texte: `Bonjour${prenom ? ` ${prenom}` : ''},\n\nAu sujet de la tâche « ${t.titre} »${quand}.${note}\n\n`,
  };
}
