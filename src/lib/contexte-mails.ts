import { cleFil, memeContact, raisonLien } from './liens-mail';
import type { ContenuMail, Mail } from './mails';
import type { Espace } from './types';

/**
 * Ce que l'IA reçoit en plus du texte d'un mail pour bien le comprendre (module pur, testé) :
 * - le fil : les messages plus anciens du même échange (« OK pour jeudi » ne veut rien dire seul) ;
 * - les noms des pièces jointes (« devis-toiture-v2.pdf ») ;
 * - le contexte de Me (« crm ») : les relances ouvertes avec ces personnes, les tâches ouvertes et les projets,
 *   chacun avec une ref, pour que l'IA reconnaisse une relance obtenue, un projet, et ne repropose pas une tâche déjà là.
 * Le serveur retire l'historique cité et les signatures ; rien de tout cela n'est gardé.
 */

/** Le mail lu pour l'analyse : son texte, les messages plus anciens du fil et ses pièces jointes. */
export type LectureMail = { texte: string; precedents?: { de: string; date?: string; texte: string }[]; pj?: string[] };

/** Au plus autant de messages plus anciens du fil, et autant de caractères chacun : de quoi comprendre, sans noyer le mail. */
export const MAX_PRECEDENTS = 3;
export const MAX_TEXTE_PRECEDENT = 600;

/** Le mail lu en entier, ramené à ce qui sert à l'analyse. */
export function lectureDe(c: Pick<ContenuMail, 'texte' | 'piecesJointes' | 'fil'>): LectureMail {
  const precedents = (c.fil ?? []).slice(-MAX_PRECEDENTS).map((x) => ({ de: x.de, ...(x.date ? { date: x.date } : {}), texte: (x.texte ?? '').slice(0, MAX_TEXTE_PRECEDENT) }));
  const pj = (c.piecesJointes ?? []).filter(Boolean).slice(0, 10);
  return { texte: c.texte ?? '', ...(precedents.length ? { precedents } : {}), ...(pj.length ? { pj } : {}) };
}

/** Le texte d'une lecture (ancienne forme : le texte seul). */
export const texteLu = (l: string | LectureMail | undefined) => (typeof l === 'string' ? l : l?.texte);

export type ContexteCrm = {
  relances: { ref: string; contact: string; sujet: string; depuis: string }[];
  taches: { ref: string; titre: string; echeance: string | null }[];
  projets: { ref: string; nom: string }[];
};

/** Les refs envoyées à l'IA : celles qu'elle peut rendre, le reste est ignoré. */
export const refRelance = (id: string) => `r:${id}`;
export const refTache = (id: string) => `t:${id}`;
export const refProjet = (id: string) => `p:${id}`;

const MAX_RELANCES = 20;
const MAX_TACHES = 30;
const MAX_PROJETS = 20;

/**
 * Le contexte de Me pour un paquet de mails : les relances ouvertes avec leurs expéditeurs (ou rattachées à leur fil),
 * les tâches ouvertes (celles qui semblent liées à ces mails d'abord, puis les plus récentes) et les projets en cours.
 */
export function contexteCrm(mails: Mail[], e: Pick<Espace, 'relances' | 'taches' | 'projets'>): ContexteCrm {
  const fils = new Set(mails.map(cleFil));
  const relances = e.relances
    .filter((r) => r.statut !== 'repondu' && ((r.mail && fils.has(r.mail.fil)) || mails.some((m) => memeContact(r.contact, m))))
    .slice(0, MAX_RELANCES)
    .map((r) => ({ ref: refRelance(r.id), contact: r.contact, sujet: r.sujet, depuis: r.date }));
  const ouvertes = e.taches.filter((t) => t.statut !== 'fait');
  const liee = (t: (typeof ouvertes)[number]) => (t.mail && fils.has(t.mail.fil)) || mails.some((m) => raisonLien({ genre: 'tache', t }, m));
  const taches = [...ouvertes.filter(liee), ...[...ouvertes.filter((t) => !liee(t))].sort((a, b) => (b.creeLe ?? '').localeCompare(a.creeLe ?? ''))]
    .slice(0, MAX_TACHES)
    .map((t) => ({ ref: refTache(t.id), titre: t.titre, echeance: t.echeance }));
  const projets = (e.projets ?? [])
    .filter((p) => !p.archive)
    .slice(0, MAX_PROJETS)
    .map((p) => ({ ref: refProjet(p.id), nom: p.nom }));
  return { relances, taches, projets };
}

/** Les refs de relances et de projets du contexte, pour relire la réponse de l'IA. */
export const refsDu = (c: ContexteCrm | undefined) => ({ relances: c?.relances.map((r) => r.ref) ?? [], projets: c?.projets.map((p) => p.ref) ?? [] });
