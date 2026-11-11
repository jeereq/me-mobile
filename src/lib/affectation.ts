import type { MembreEquipe } from './equipes';
import type { Tache } from './types';

/**
 * Confier une tâche à un membre de l'équipe, ou lui écrire à son sujet.
 *
 * Une tâche porte `affecteA` (le compte du membre) et `responsable` (son nom, pour l'affichage et pour les tâches plus
 * anciennes, qui n'avaient que le nom). Plusieurs membres peuvent l'effectuer (`executants`, dont `affecteA` est le
 * premier) et d'autres la suivre (`suivis`). Le serveur prévient chaque membre quand il est ajouté.
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

/** Ce qui se confie sur une tâche : ceux qui l'effectuent (`affecteA` est le premier) et ceux qui la suivent. */
export type Affectes = { affecteA?: string; responsable?: string; executants?: string[]; suivis?: string[] };
type QuiTache = Pick<Tache, 'affecteA' | 'responsable' | 'executants' | 'suivis'>;

/** Les comptes qui effectuent la tâche, chacun une fois, le premier d'abord. */
export const idsExecutants = (t: Pick<Tache, 'affecteA' | 'executants'>): string[] => [...new Set([...(t.affecteA ? [t.affecteA] : []), ...(t.executants ?? [])])];

/** Les membres qui effectuent la tâche ; pour une tâche plus ancienne, celui dont le nom est écrit dans « responsable ». */
export function executantsDe(membres: MembreEquipe[], t: QuiTache): MembreEquipe[] {
  const ids = idsExecutants(t);
  if (ids.length) return ids.flatMap((id) => membres.find((m) => m.id === id) ?? []);
  const ancien = membreDe(membres, t);
  return ancien ? [ancien] : [];
}

/** Les membres qui suivent la tâche : ceux qui l'effectuent déjà n'ont pas à la suivre. */
export function suivisDe(membres: MembreEquipe[], t: QuiTache): MembreEquipe[] {
  const fait = new Set(idsExecutants(t));
  return [...new Set(t.suivis ?? [])].flatMap((id) => (fait.has(id) ? [] : (membres.find((m) => m.id === id) ?? [])));
}

/** Ce que change dans la tâche la liste complète de ceux qui l'effectuent (vide : personne). Le nom écrit à la main d'un non-membre reste. */
export function patchExecutants(membres: MembreEquipe[], t: QuiTache, choisis: MembreEquipe[]): Affectes {
  if (!choisis.length) return { affecteA: undefined, executants: undefined, responsable: executantsDe(membres, t).length ? undefined : t.responsable };
  const ids = choisis.map((m) => m.id);
  const suivis = (t.suivis ?? []).filter((id) => !ids.includes(id));
  return { affecteA: ids[0], executants: ids.length > 1 ? ids : undefined, responsable: choisis.map(nomMembre).join(', '), ...(suivis.length !== (t.suivis ?? []).length ? { suivis: suivis.length ? suivis : undefined } : {}) };
}

/** Ajoute ce membre à ceux qui effectuent la tâche, ou le retire s'il en fait déjà partie. */
export function basculerExecutant(membres: MembreEquipe[], t: QuiTache, m: MembreEquipe): Affectes {
  const actuels = executantsDe(membres, t);
  return patchExecutants(membres, t, actuels.some((x) => x.id === m.id) ? actuels.filter((x) => x.id !== m.id) : [...actuels, m]);
}

/** Ajoute ce membre à ceux qui suivent la tâche, ou le retire. Un exécutant n'a pas à la suivre : rien ne change. */
export function basculerSuivi(t: QuiTache, m: Pick<MembreEquipe, 'id'>): Pick<Affectes, 'suivis'> {
  if (idsExecutants(t).includes(m.id)) return {};
  const actuels = t.suivis ?? [];
  const suivants = actuels.includes(m.id) ? actuels.filter((id) => id !== m.id) : [...actuels, m.id];
  return { suivis: suivants.length ? suivants : undefined };
}

const dateFr = (d: string) => d.split('-').reverse().join('/');

/** Le brouillon du mail « à propos de cette tâche » : à ceux qui l'effectuent s'il y en a, sinon l'adresse est à écrire. */
export function brouillonMailTache(t: Pick<Tache, 'titre' | 'echeance' | 'note'>, qui: MembreEquipe | MembreEquipe[] | null) {
  const membres = qui ? (Array.isArray(qui) ? qui : [qui]) : [];
  const membre = membres.length === 1 ? membres[0] : null;
  const prenom = membre ? (membre.nom || '').trim().split(/\s+/)[0] : '';
  const quand = t.echeance ? ` (à faire pour le ${dateFr(t.echeance)})` : '';
  const note = t.note?.trim() ? `\n\n${t.note.trim()}` : '';
  return {
    ...(membres.length ? { a: membres.map((m) => m.email).join(', ') } : {}),
    sujet: `Tâche : ${t.titre}`,
    texte: `Bonjour${prenom ? ` ${prenom}` : membres.length > 1 ? ' à tous' : ''},\n\nAu sujet de la tâche « ${t.titre} »${quand}.${note}\n\n`,
  };
}
