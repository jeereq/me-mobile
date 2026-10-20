import { today } from './dates';
import type { Boite, Config, Espace, Evenement, Relance, SourceKey, Tache } from './types';

export type Fournisseur = 'google' | 'microsoft' | 'trello' | 'slack';
export type CompteConnecte = { id: string; fournisseur: Fournisseur; compte: string; ctx: Boite; derniereSync: string | null; erreur: string | null };
export type Disponible = { nom: Fournisseur; sources: SourceKey[]; configure: boolean };

type Base = { id: string; source: SourceKey; ctx: Boite; lien?: string };
export type Synchro = {
  integrations: CompteConnecte[];
  agenda: (Base & { date: string; debut: string; fin?: string; titre: string; lieu?: string })[];
  taches: (Base & { titre: string; echeance: string | null })[];
  relances: (Base & { contact: string; sujet: string; date: string })[];
};

export const FOURNISSEURS: Record<Fournisseur, string> = { google: 'Google (Agenda et Gmail)', microsoft: 'Microsoft (Outlook et To Do)', trello: 'Trello', slack: 'Slack' };

const externe = (id: string) => id.startsWith('ext:');

/**
 * Fusionne les éléments importés par le serveur dans l'espace :
 * l'agenda importé est remplacé, les nouvelles tâches et relances sont ajoutées avec le mode par défaut,
 * celles qui ont disparu de leur source (mail désétoilé, réponse reçue) partent si elles n'étaient pas traitées.
 * Ce que tu as supprimé dans me ne revient pas.
 */
export function fusionner(e: Espace, s: Synchro, c: Config): Espace {
  const vus = new Set(e.importsVus || []);
  const now = new Date().toISOString();

  const agenda: Record<string, Evenement[]> = {};
  for (const [d, evs] of Object.entries(e.agenda)) {
    const restants = evs.filter((x) => !x.id || !externe(x.id));
    if (restants.length) agenda[d] = restants;
  }
  for (const x of s.agenda) (agenda[x.date] ||= []).push({ id: x.id, debut: x.debut, fin: x.fin, titre: x.titre, lieu: x.lieu, source: x.source, calendrier: x.ctx, lien: x.lien });
  for (const d of Object.keys(agenda)) agenda[d].sort((a, b) => a.debut.localeCompare(b.debut));

  const idsT = new Set(s.taches.map((x) => x.id));
  const taches: Tache[] = e.taches.filter((t) => !externe(t.id) || idsT.has(t.id) || t.statut === 'fait');
  const presentsT = new Set(taches.map((t) => t.id));
  for (const x of s.taches) {
    if (presentsT.has(x.id) || vus.has(x.id)) continue;
    taches.push({ id: x.id, titre: x.titre, source: x.ctx, priorite: 'moyenne', echeance: x.echeance, statut: 'en_attente', mode: c.defauts.tache, creeLe: now, ext: x.source, lien: x.lien });
  }

  const idsR = new Set(s.relances.map((x) => x.id));
  const relances: Relance[] = e.relances.filter((r) => !externe(r.id) || idsR.has(r.id) || r.statut !== 'a_faire');
  const presentsR = new Set(relances.map((r) => r.id));
  for (const x of s.relances) {
    if (presentsR.has(x.id) || vus.has(x.id)) continue;
    relances.push({ id: x.id, contact: x.contact, sujet: x.sujet, boite: x.ctx, date: x.date || today(), statut: 'a_faire', mode: c.defauts.relance, creeLe: now, ext: x.source, lien: x.lien });
  }

  return { ...e, agenda, taches, relances, importsVus: [...idsT, ...idsR] };
}

/** Vrai si la fusion change quelque chose (évite une sauvegarde à chaque synchro). */
export const differe = (a: Espace, b: Espace) =>
  JSON.stringify([a.agenda, a.taches, a.relances, a.importsVus]) !== JSON.stringify([b.agenda, b.taches, b.relances, b.importsVus]);
