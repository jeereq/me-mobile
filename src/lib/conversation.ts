import { lireJson } from './copilote';

/** Parler au copilote : le fil des échanges et les gestes proposés sous chaque réponse. Module pur. */

export type GenreAction = 'tache' | 'relance' | 'mail';
export type ActionConversation = {
  id: string;
  genre: GenreAction;
  titre: string;
  contact?: string;
  echeance: string | null;
  /** Le mail auquel répondre. */
  ref?: string;
  brouillon?: string;
  /** L'élément créé par ce geste : le bouton l'indique, et on peut l'annuler. */
  cree?: string;
};
export type Echange = { id: string; question: string; reponse: string; actions: ActionConversation[] };

export const MAX_ECHANGES = 20;
const MAX_HISTORIQUE = 6;
const MAX_ACTIONS = 3;

const chaine = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const jour = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Les derniers échanges, pour que le copilote garde le fil. */
export const historiqueDe = (echanges: Pick<Echange, 'question' | 'reponse'>[]) => echanges.slice(-MAX_HISTORIQUE).map((e) => ({ q: e.question.slice(0, 2000), r: e.reponse.slice(0, 4000) }));

/**
 * La réponse de l'IA. Un geste incomplet ou un mail inconnu est écarté : l'IA ne décide pas à quoi l'utilisateur répond.
 * Un texte simple (ancien serveur) reste une réponse, sans geste.
 */
export function lireConversation(brut: string, mails: Set<string>): { reponse: string; actions: ActionConversation[] } {
  const j = lireJson(brut);
  if (!j || typeof j.reponse !== 'string') return { reponse: brut.trim(), actions: [] };
  const actions: ActionConversation[] = [];
  for (const a of Array.isArray(j.actions) ? (j.actions as Record<string, unknown>[]) : []) {
    if (actions.length >= MAX_ACTIONS) break;
    const titre = chaine(a?.titre, 160);
    if (!titre) continue;
    const id = String(actions.length);
    if (a.genre === 'tache') actions.push({ id, genre: 'tache', titre, echeance: jour(a.echeance) });
    else if (a.genre === 'relance') {
      const contact = chaine(a.contact, 120);
      if (contact) actions.push({ id, genre: 'relance', titre, contact, echeance: jour(a.echeance) });
    } else if (a.genre === 'mail' && typeof a.ref === 'string' && mails.has(a.ref)) {
      const brouillon = chaine(a.brouillon, 4000);
      actions.push({ id, genre: 'mail', titre, echeance: null, ref: a.ref, ...(brouillon ? { brouillon } : {}) });
    }
  }
  return { reponse: j.reponse.trim(), actions };
}

/** Le fil relu sur l'appareil : seulement celui de ce compte et de cet espace. */
export function lireEchanges(brut: unknown, pour: string): Echange[] {
  const b = brut as { pour?: unknown; echanges?: unknown } | null;
  if (!b || b.pour !== pour || !Array.isArray(b.echanges)) return [];
  return (b.echanges as Partial<Echange>[])
    .filter((e) => e && typeof e.id === 'string' && typeof e.question === 'string' && typeof e.reponse === 'string')
    .map((e) => ({ id: e.id!, question: e.question!, reponse: e.reponse!, actions: Array.isArray(e.actions) ? e.actions : [] }))
    .slice(-MAX_ECHANGES);
}

/** Ajoute un échange, sans dépasser ce que l'appareil garde. */
export const ajouterEchange = (echanges: Echange[], e: Echange) => [...echanges, e].slice(-MAX_ECHANGES);

/** Note l'élément créé par un geste, ou l'oublie (annulation). */
export const marquerAction = (echanges: Echange[], echange: string, action: string, cree?: string): Echange[] =>
  echanges.map((e) => (e.id === echange ? { ...e, actions: e.actions.map((a) => (a.id === action ? (cree ? { ...a, cree } : (({ cree: _c, ...r }) => r)(a)) : a)) } : e));
