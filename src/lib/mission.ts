import { addDays, doneIn, habitToday, habitWhen, periodKey } from './dates';
import { POINTS } from './jeu';
import { resumes, tachesUrgentes } from './planning';
import { relanceAttendue } from './suivi';
import type { Espace, Habitude, Mode, Relance, Tache } from './types';

/**
 * La mission du jour : tout ce qui compte aujourd'hui, en une seule liste
 * (habitudes prévues, relances arrivées à échéance, tâches urgentes), y compris ce qui est déjà fait aujourd'hui.
 */
export type ElementMission =
  | { type: 'habitude'; cle: string; id: string; titre: string; detail: string; fait: boolean; points: number; mode: Mode; item: Habitude }
  | { type: 'relance'; cle: string; id: string; titre: string; detail: string; fait: boolean; points: number; mode: Mode; item: Relance }
  | { type: 'tache'; cle: string; id: string; titre: string; detail: string; fait: boolean; points: number; mode: Mode; item: Tache };

export const cleHabitude = (h: Habitude, d: string) => `h:${h.id}:${periodKey(h.frequence, d)}`;
export const cleRelance = (r: Relance) => `r:${r.id}`;
export const cleTache = (t: Tache) => `t:${t.id}`;
export const pointsTache = (t: Tache, d: string) => (t.priorite === 'haute' ? POINTS.tacheHaute : POINTS.tache) + (t.echeance && d <= t.echeance ? POINTS.ponctuel : 0);

const urgence: Record<Mode, number> = { agressif: 0, normal: 1, coach: 2, hebdo: 3, passif: 4 };

export function missionDuJour(e: Espace, d: string): ElementMission[] {
  const bientot = addDays(d, 2);
  const out: ElementMission[] = [];
  for (const r of e.relances) {
    if (!((relanceAttendue(r) && r.date <= d) || (r.statut === 'repondu' && r.reponduLe === d))) continue;
    out.push({ type: 'relance', cle: cleRelance(r), id: r.id, titre: `${r.statut === 'relance' ? 'Relancer à nouveau' : 'Relancer'} ${r.contact}`, detail: r.sujet + (r.date < d && r.statut !== 'repondu' ? ' · en retard' : ''), fait: r.statut === 'repondu', points: POINTS.relance, mode: r.mode, item: r });
  }
  // Tâches de projet : seulement celles à faire bientôt et pas bloquées ; jamais les résumés (voir `planning.ts`).
  const urgentes = new Set(tachesUrgentes(e, d, bientot).map((t) => t.id));
  const parents = resumes(e.taches);
  for (const t of e.taches) {
    if (parents.has(t.id)) continue;
    if (!(urgentes.has(t.id) || (t.statut === 'fait' && t.faitLe === d))) continue;
    const quand = t.echeance ? (t.echeance < d ? 'en retard' : t.echeance === d ? "pour aujourd'hui" : 'bientôt') : 'priorité haute';
    out.push({ type: 'tache', cle: cleTache(t), id: t.id, titre: t.titre, detail: quand, fait: t.statut === 'fait', points: pointsTache(t, d), mode: t.mode, item: t });
  }
  for (const h of e.habitudes) {
    // Une habitude cochée aujourd'hui reste dans la mission, même si elle n'était due qu'en rattrapage.
    if (!habitToday(h, d) && !h.coches.includes(d)) continue;
    out.push({ type: 'habitude', cle: cleHabitude(h, d), id: h.id, titre: h.nom, detail: habitWhen(h), fait: doneIn(h, d), points: POINTS.habitude, mode: h.mode, item: h });
  }
  const rang = { relance: 0, tache: 1, habitude: 2 };
  return out.sort((a, b) => urgence[a.mode] - urgence[b.mode] || rang[a.type] - rang[b.type]);
}
