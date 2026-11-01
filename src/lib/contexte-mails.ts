import { cleFil, memeContact, raisonLien } from './liens-mail';
import type { Mail } from './mails';
import type { Espace } from './types';

/**
 * Le contexte de Me envoyé avec une demande d'analyse (module pur, testé) : les relances ouvertes avec ces personnes,
 * les tâches ouvertes et les projets, chacun avec une ref, pour que l'IA reconnaisse une relance obtenue, un projet,
 * et ne repropose pas une tâche déjà là. Le serveur lit lui-même les mails (fil et pièces jointes compris) ; rien de tout cela
 * n'est gardé que l'analyse elle-même.
 */

export type ContexteCrm = {
  relances: { ref: string; contact: string; sujet: string; depuis: string }[];
  taches: { ref: string; titre: string; echeance: string | null }[];
  projets: { ref: string; nom: string }[];
};

/** Les refs envoyées à l'IA : celles qu'elle peut rendre, le reste est ignoré. */
export const refRelance = (id: string) => `r:${id}`;
export const refTache = (id: string) => `t:${id}`;
export const refProjet = (id: string) => `p:${id}`;

/** Au plus autant d'éléments, et des textes coupés à ce que le serveur accepte. */
const MAX_RELANCES = 20;
const MAX_TACHES = 30;
const MAX_PROJETS = 20;
const coupe = (s: string | undefined, n: number) => String(s ?? '').slice(0, n);

/**
 * Le contexte de Me pour un paquet de mails : les relances ouvertes avec leurs expéditeurs (ou rattachées à leur fil),
 * les tâches ouvertes (celles qui semblent liées à ces mails d'abord, puis les plus récentes) et les projets en cours.
 */
export function contexteCrm(mails: Mail[], e: Pick<Espace, 'relances' | 'taches' | 'projets'>): ContexteCrm {
  const fils = new Set(mails.map(cleFil));
  const relances = e.relances
    .filter((r) => r.statut !== 'repondu' && ((r.mail && fils.has(r.mail.fil)) || mails.some((m) => memeContact(r.contact, m))))
    .slice(0, MAX_RELANCES)
    .map((r) => ({ ref: refRelance(r.id), contact: coupe(r.contact, 200), sujet: coupe(r.sujet, 300), depuis: coupe(r.date, 10) }));
  const ouvertes = e.taches.filter((t) => t.statut !== 'fait');
  const liee = (t: (typeof ouvertes)[number]) => (t.mail && fils.has(t.mail.fil)) || mails.some((m) => raisonLien({ genre: 'tache', t }, m));
  const taches = [...ouvertes.filter(liee), ...[...ouvertes.filter((t) => !liee(t))].sort((a, b) => (b.creeLe ?? '').localeCompare(a.creeLe ?? ''))]
    .slice(0, MAX_TACHES)
    .map((t) => ({ ref: refTache(t.id), titre: coupe(t.titre, 300), echeance: t.echeance ?? null }));
  const projets = (e.projets ?? [])
    .filter((p) => !p.archive)
    .slice(0, MAX_PROJETS)
    .map((p) => ({ ref: refProjet(p.id), nom: coupe(p.nom, 200) }));
  return { relances, taches, projets };
}

/** Les refs de relances et de projets du contexte, pour relire la réponse de l'IA. */
export const refsDu = (c: ContexteCrm | undefined) => ({ relances: c?.relances.map((r) => r.ref) ?? [], projets: c?.projets.map((p) => p.ref) ?? [] });
