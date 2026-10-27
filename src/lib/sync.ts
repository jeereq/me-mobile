import { today } from './dates';
import type { Mail } from './mails';
import { refExterne } from './externe';
import type { Boite, Config, Espace, Evenement, LienMail, Relance, SourceKey, Tache } from './types';

export type Fournisseur = 'google' | 'microsoft' | 'trello' | 'slack';
/** Une étiquette qu'on peut poser sur un mail du compte (libellé Gmail, catégorie Outlook). */
export type LibelleDispo = { nom: string; couleur?: string };
export type CompteConnecte = {
  id: string;
  fournisseur: Fournisseur;
  compte: string;
  ctx: Boite;
  derniereSync: string | null;
  erreur: string | null;
  /** Agendas cochés pour ce compte ; vide = ceux affichés par défaut dans le service. */
  agendas?: string[];
  /** Le service sait lire des boîtes partagées avec ce compte (Microsoft 365). */
  partageables?: boolean;
  /** Boîtes partagées lues avec ce compte, et l'erreur de la dernière lecture. */
  boites?: { adresse: string; erreur?: string }[];
  libelles?: LibelleDispo[];
};
/** Un agenda du compte, tel que le service le nomme. */
export type AgendaDispo = { id: string; nom: string; principal?: boolean; visible?: boolean; couleur?: string };
export type Disponible = { nom: Fournisseur; sources: SourceKey[]; configure: boolean };

/** Le mail d'où vient une tâche ou une relance importée (fil tel que le service le nomme). */
type MailOrigine = { fil: string; sujet: string; contact?: string; adresse?: string };
type Base = { id: string; source: SourceKey; ctx: Boite; lien?: string; mail?: MailOrigine };
export type Synchro = {
  integrations: CompteConnecte[];
  agenda: (Base & { date: string; debut: string; fin?: string; titre: string; lieu?: string; /** Nom de l'agenda d'origine. */ agenda?: string })[];
  taches: (Base & { titre: string; echeance: string | null })[];
  relances: (Base & { contact: string; sujet: string; date: string })[];
  /** Fils récents des boîtes connectées : objet, contact, date et lien, jamais le contenu. */
  mails?: Mail[];
};

export const FOURNISSEURS: Record<Fournisseur, string> = { google: 'Google (Agenda et Gmail)', microsoft: 'Microsoft (Outlook et To Do)', trello: 'Trello', slack: 'Slack' };

const externe = (id: string) => id.startsWith('ext:');

/** Le lien vers le mail d'origine d'un élément importé, à la clé de fil de la boîte de Me (`liens-mail.ts`). */
function lienImporte(x: Base): LienMail | undefined {
  const r = refExterne(x.id);
  if (!x.mail?.fil || !r) return undefined;
  return { fil: `${r.compte}:${x.mail.fil}`, sujet: x.mail.sujet, ...(x.mail.contact ? { contact: x.mail.contact } : {}), ...(x.mail.adresse ? { adresse: x.mail.adresse.replace(/^.*<([^>]+)>.*$/, '$1').trim() } : {}), ...(x.lien ? { lien: x.lien } : {}), source: x.source };
}

/** Rattache au mail d'origine un élément importé qui ne l'est pas encore, sauf si l'utilisateur l'en a détaché. */
function rattacher<T extends Relance | Tache>(el: T, x: Base | undefined): T {
  if (!x || el.mail) return el;
  const l = lienImporte(x);
  return l && !(el.mailsEcartes ?? []).includes(l.fil) ? { ...el, mail: l } : el;
}

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
  for (const x of s.agenda) (agenda[x.date] ||= []).push({ id: x.id, debut: x.debut, fin: x.fin, titre: x.titre, lieu: x.lieu, source: x.source, calendrier: x.ctx, lien: x.lien, agenda: x.agenda });
  for (const d of Object.keys(agenda)) agenda[d].sort((a, b) => a.debut.localeCompare(b.debut));

  const idsT = new Set(s.taches.map((x) => x.id));
  const parIdT = new Map(s.taches.map((x) => [x.id, x]));
  const taches: Tache[] = e.taches.filter((t) => !externe(t.id) || idsT.has(t.id) || t.statut === 'fait').map((t) => rattacher(t, parIdT.get(t.id)));
  const presentsT = new Set(taches.map((t) => t.id));
  for (const x of s.taches) {
    if (presentsT.has(x.id) || vus.has(x.id)) continue;
    const mail = lienImporte(x);
    taches.push({ id: x.id, titre: x.titre, source: x.ctx, priorite: 'moyenne', echeance: x.echeance, statut: 'en_attente', mode: c.defauts.tache, creeLe: now, ext: x.source, lien: x.lien, ...(mail ? { mail } : {}) });
  }

  const idsR = new Set(s.relances.map((x) => x.id));
  const parIdR = new Map(s.relances.map((x) => [x.id, x]));
  const relances: Relance[] = e.relances.filter((r) => !externe(r.id) || idsR.has(r.id) || r.statut !== 'a_faire').map((r) => rattacher(r, parIdR.get(r.id)));
  const presentsR = new Set(relances.map((r) => r.id));
  for (const x of s.relances) {
    if (presentsR.has(x.id) || vus.has(x.id)) continue;
    const mail = lienImporte(x);
    relances.push({ id: x.id, contact: x.contact, sujet: x.sujet, boite: x.ctx, date: x.date || today(), statut: 'a_faire', mode: c.defauts.relance, creeLe: now, ext: x.source, lien: x.lien, ...(mail ? { mail } : {}) });
  }

  return { ...e, agenda, taches, relances, importsVus: [...idsT, ...idsR] };
}

/** Vrai si la fusion change quelque chose (évite une sauvegarde à chaque synchro). */
export const differe = (a: Espace, b: Espace) =>
  JSON.stringify([a.agenda, a.taches, a.relances, a.importsVus]) !== JSON.stringify([b.agenda, b.taches, b.relances, b.importsVus]);
