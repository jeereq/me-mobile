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
