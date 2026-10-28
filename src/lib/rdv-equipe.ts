import { uid } from './dates';
import type { Evenement } from './types';

/**
 * Les rendez-vous créés dans Me, dans l'espace d'une équipe. Les comptes connectés (Google, Microsoft) n'alimentent que
 * l'espace personnel : l'équipe n'avait donc aucun rendez-vous. Ceux-ci vivent dans `agenda` (une liste par jour) comme les
 * autres, avec un identifiant `me:…` qui les distingue de ceux d'un agenda connecté, et un propriétaire (`affecteA`).
 * Ce fichier n'importe que des types : il se teste avec `npm test`, sans l'app.
 */

export type Agenda = Record<string, Evenement[]>;

export const idRdvLocal = () => `me:${uid()}`;
/** Un rendez-vous créé dans Me (et non importé d'un agenda connecté) : on peut le modifier et le supprimer ici. */
export const estRdvLocal = (id?: string) => !!id && id.startsWith('me:');

const HEURE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
/** « 9:30 » → « 09:30 ». */
export const heureComplete = (h: string) => {
  const t = h.trim().replace('h', ':');
  return HEURE.test(t) ? t.padStart(5, '0') : null;
};

export type SaisieRdv = { titre: string; jour: string | null | undefined; journee: boolean; debut: string; fin: string };

/** Ce qui empêche d'enregistrer le rendez-vous, en clair, ou null s'il est bon. */
export function erreurRdv(s: SaisieRdv): string | null {
  if (!s.titre.trim()) return 'Donne un titre au rendez-vous.';
  if (!s.jour || !JOUR.test(s.jour)) return 'Choisis le jour du rendez-vous.';
  if (s.journee) return null;
  const d = heureComplete(s.debut);
  if (!d) return 'L’heure de début doit s’écrire comme 09:30.';
  if (s.fin.trim()) {
    const f = heureComplete(s.fin);
    if (!f) return 'L’heure de fin doit s’écrire comme 10:30.';
    if (f <= d) return 'La fin doit venir après le début.';
  }
  return null;
}

/** Le rendez-vous tel qu'il est gardé dans l'agenda, à partir de ce qui est saisi. `Journée` marque un jour entier. */
export function rdvDeSaisie(id: string, s: SaisieRdv, lieu: string, proprietaire: { affecteA?: string; responsable?: string }): Evenement {
  return {
    id,
    debut: s.journee ? 'Journée' : heureComplete(s.debut)!,
    ...(!s.journee && s.fin.trim() ? { fin: heureComplete(s.fin)! } : {}),
    titre: s.titre.trim(),
    ...(lieu.trim() ? { lieu: lieu.trim() } : {}),
    calendrier: 'pro',
    ...(proprietaire.affecteA ? { affecteA: proprietaire.affecteA } : {}),
    ...(proprietaire.responsable ? { responsable: proprietaire.responsable } : {}),
  };
}

const trier = (l: Evenement[]) => [...l].sort((a, b) => a.debut.localeCompare(b.debut) || a.titre.localeCompare(b.titre, 'fr'));

/** L'agenda sans ce rendez-vous (un jour vide disparaît). */
export function sansRdv(agenda: Agenda, id: string): Agenda {
  const sortie: Agenda = {};
  for (const [jour, l] of Object.entries(agenda)) {
    const reste = l.filter((x) => x.id !== id);
    if (reste.length) sortie[jour] = reste;
  }
  return sortie;
}

/** Pose le rendez-vous à son jour, en remplaçant l'ancienne version si on le modifie (même identifiant, peut-être un autre jour). */
export function avecRdv(agenda: Agenda, jour: string, ev: Evenement): Agenda {
  const propre = ev.id ? sansRdv(agenda, ev.id) : { ...agenda };
  return { ...propre, [jour]: trier([...(propre[jour] ?? []), ev]) };
}
