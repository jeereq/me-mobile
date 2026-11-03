import type { ActionMail, AnalyseMail } from './copilote';

/**
 * L'analyse d'un lot de mails, rangée pour décider vite : ce qui attend une réponse, ce qui demande un travail, puis le reste,
 * regroupé par expéditeur. Module pur, testé dans tests/tri-analyses.test.ts.
 */

export const ORDRE_ONGLETS: ActionMail[] = ['repondre', 'tache', 'rien'];
const RANG_URGENCE = { haute: 0, normale: 1, basse: 2 } as const;

/** Le plus urgent d'abord, puis la date limite la plus proche. L'ordre d'arrivée départage le reste. */
export function trierAnalyses<A extends Pick<AnalyseMail, 'urgence' | 'echeance'>>(liste: A[]): A[] {
  return [...liste].sort((a, b) => RANG_URGENCE[a.urgence] - RANG_URGENCE[b.urgence] || (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999'));
}

export function parOnglet<A extends Pick<AnalyseMail, 'action' | 'urgence' | 'echeance'>>(liste: A[]): Record<ActionMail, A[]> {
  const garder = (action: ActionMail) => trierAnalyses(liste.filter((a) => a.action === action));
  return { repondre: garder('repondre'), tache: garder('tache'), rien: garder('rien') };
}

/** Le premier onglet qui a quelque chose à montrer. */
export const ongletInitial = <A,>(onglets: Record<ActionMail, A[]>): ActionMail => ORDRE_ONGLETS.find((o) => onglets[o].length) ?? 'repondre';

/** Les mails sans action, par expéditeur : celui qui en envoie le plus d'abord. */
export function parExpediteur<A>(liste: A[], contactDe: (a: A) => string): { contact: string; analyses: A[] }[] {
  const groupes = new Map<string, { contact: string; analyses: A[] }>();
  for (const a of liste) {
    const contact = contactDe(a).trim() || 'Sans expéditeur';
    const cle = contact.toLowerCase();
    const g = groupes.get(cle);
    if (g) g.analyses.push(a);
    else groupes.set(cle, { contact, analyses: [a] });
  }
  return [...groupes.values()].sort((a, b) => b.analyses.length - a.analyses.length);
}

/** « Paul », « Paul et Ana », « Paul, Ana et 3 autres » : à qui part un envoi groupé. */
export function destinataires(noms: string[]): string {
  const uniques = [...new Set(noms.map((n) => n.trim() || 'Sans expéditeur'))];
  if (uniques.length <= 2) return uniques.join(' et ');
  return `${uniques.slice(0, 2).join(', ')} et ${uniques.length - 2} autre${uniques.length > 3 ? 's' : ''}`;
}

/* ——— Filtres sur les résultats ——— */

export type FiltresAnalyse = { q: string; urgent: boolean; echeance: boolean; montant: boolean; rdv: boolean; relance: boolean; categories: string[]; boites: string[]; expediteurs: string[] };
export const FILTRES_VIDES: FiltresAnalyse = { q: '', urgent: false, echeance: false, montant: false, rdv: false, relance: false, categories: [], boites: [], expediteurs: [] };

/** Combien de filtres sont actifs, sans compter la recherche (elle se voit dans son champ). */
export const nbFiltres = (f: FiltresAnalyse) => [f.urgent, f.echeance, f.montant, f.rdv, f.relance].filter(Boolean).length + f.categories.length + f.boites.length + f.expediteurs.length;

type MailFiltre = { contact?: string; sujet?: string; adresse?: string; boite?: string; compte?: string };
type AnalyseFiltre = Pick<AnalyseMail, 'urgence' | 'echeance' | 'montant' | 'rdv' | 'relance' | 'categorie' | 'resume'> & { id: string };
const sansAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const nomExpediteur = (m?: MailFiltre) => m?.contact?.trim() || 'Sans expéditeur';
const boiteDe = (m?: MailFiltre) => m?.boite || m?.compte || '';

/** Les cases d'une même famille s'additionnent (Facture ou Devis) ; les familles se combinent (une facture urgente de Paul). */
export function filtrerAnalyses<A extends AnalyseFiltre>(liste: A[], mailDe: (id: string) => MailFiltre | undefined, f: FiltresAnalyse): A[] {
  const mots = sansAccents(f.q).split(/\s+/).filter(Boolean);
  return liste.filter((a) => {
    const m = mailDe(a.id);
    if (f.urgent && a.urgence !== 'haute') return false;
    if (f.echeance && !a.echeance) return false;
    if (f.montant && !a.montant) return false;
    if (f.rdv && !a.rdv) return false;
    if (f.relance && !a.relance) return false;
    if (f.categories.length && !(a.categorie && f.categories.includes(a.categorie))) return false;
    if (f.boites.length && !f.boites.includes(boiteDe(m))) return false;
    if (f.expediteurs.length && !f.expediteurs.includes(nomExpediteur(m))) return false;
    if (mots.length) {
      const texte = sansAccents([m?.contact, m?.adresse, m?.sujet, a.resume].filter(Boolean).join(' '));
      if (!mots.every((x) => texte.includes(x))) return false;
    }
    return true;
  });
}

const compter = (valeurs: string[]) => {
  const n = new Map<string, number>();
  for (const v of valeurs) if (v) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n].map(([cle, nb]) => ({ cle, nb })).sort((a, b) => b.nb - a.nb);
};

/** Ce qu'on peut filtrer dans ces résultats, avec le nombre de mails : on ne propose jamais un filtre vide. */
export function facettes<A extends AnalyseFiltre>(liste: A[], mailDe: (id: string) => MailFiltre | undefined) {
  return {
    urgent: liste.filter((a) => a.urgence === 'haute').length,
    echeance: liste.filter((a) => a.echeance).length,
    montant: liste.filter((a) => a.montant).length,
    rdv: liste.filter((a) => a.rdv).length,
    relance: liste.filter((a) => a.relance).length,
    categories: compter(liste.map((a) => a.categorie ?? '')),
    boites: compter(liste.map((a) => boiteDe(mailDe(a.id)))),
    expediteurs: compter(liste.map((a) => nomExpediteur(mailDe(a.id)))).slice(0, 8),
  };
}

/* ——— Filtres avant l'analyse ——— */

const ADRESSE_ROBOT = /^(?:(?:no-?reply|do-?not-?reply|ne-?pas-?repondre|mailer-daemon|postmaster|bounces?)[^@]*|(?:notifications?|newsletters?|alerts?)(?:\+[^@]*)?)@/i;
const NOM_ROBOT = /\[bot\]|no-?reply/i;

/** Un mail envoyé par un robot : notifications, sans réponse possible, lettres d'information. Il coûte une analyse sans rien demander. */
export const estAutomatique = (m: { contact?: string; adresse?: string }) => ADRESSE_ROBOT.test(m.adresse?.trim() ?? '') || NOM_ROBOT.test(m.contact ?? '');

export type FiltresLot = { nonLus: boolean; pj: boolean; sansAuto: boolean; sansPartagees: boolean; objet: string };
export const LOT_SANS_FILTRE: FiltresLot = { nonLus: false, pj: false, sansAuto: false, sansPartagees: false, objet: '' };

/** Les mails trouvés qui passent les filtres choisis avant l'analyse. */
export function filtrerLot<M extends { contact?: string; adresse?: string; sujet?: string; nonLu?: boolean; pj?: boolean; boite?: string }>(mails: M[], f: FiltresLot): M[] {
  const mots = sansAccents(f.objet).split(/\s+/).filter(Boolean);
  return mails.filter((m) => {
    if (f.nonLus && !m.nonLu) return false;
    if (f.pj && !m.pj) return false;
    if (f.sansAuto && estAutomatique(m)) return false;
    if (f.sansPartagees && m.boite) return false;
    const sujet = sansAccents(m.sujet ?? '');
    return mots.every((x) => sujet.includes(x));
  });
}

/** Ce que le copilote a déjà tiré d'un mail, montré dans la liste. */
export type EtatMail = { id: string; urgence: string; action: string; resume: string; reponse: string };
export type FiltreEtat = 'urgent' | 'pret';
export const etatUrgent = (e?: EtatMail) => e?.urgence === 'haute';
export const etatPret = (e?: EtatMail) => e?.action === 'repondre' && !!e.reponse.trim();

/** Les mails non lus urgents, ou dont la réponse est prête : un mail traité (lu) ne compte plus. */
export function filtrerParEtat<M extends { id: string; nonLu?: boolean }>(mails: M[], etats: Map<string, EtatMail>, filtre: FiltreEtat): M[] {
  const test = filtre === 'urgent' ? etatUrgent : etatPret;
  return mails.filter((m) => m.nonLu && test(etats.get(m.id)));
}
