import type { DecisionExco, Tache } from './types';

export const STATUTS_DECISION: { cle: DecisionExco['statut']; nom: string }[] = [
  { cle: 'a_prendre', nom: 'À prendre' },
  { cle: 'prise', nom: 'Prise' },
  { cle: 'refusee', nom: 'Refusée' },
  { cle: 'reportee', nom: 'Reportée' },
];
export const nomStatutDecision = (s: DecisionExco['statut']) => STATUTS_DECISION.find((x) => x.cle === s)?.nom ?? s;
export const decisionsDe = (e: { decisionsExco?: DecisionExco[] }) => e.decisionsExco ?? [];

/** Encore ouverte : il reste à la prendre (ou à la reprendre après un report). */
export const estOuverte = (d: DecisionExco) => d.statut === 'a_prendre' || d.statut === 'reportee';

export function nouvelleDecision(o: { id: string; date: string; maintenant: string; titre?: string; projet?: string; tache?: string }): DecisionExco {
  return { id: o.id, titre: o.titre ?? '', date: o.date, statut: 'a_prendre', ...(o.projet ? { projet: o.projet } : {}), ...(o.tache ? { tache: o.tache } : {}), creeLe: o.maintenant };
}

/** À prendre d'abord (la plus proche en tête), puis le journal du plus récent au plus ancien. */
export const trierDecisions = (l: DecisionExco[]): DecisionExco[] => [...l].sort((a, b) => Number(estOuverte(b)) - Number(estOuverte(a)) || (estOuverte(a) ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || b.creeLe.localeCompare(a.creeLe));

/** Les actions « À valider » dont aucune décision ouverte du journal ne s'occupe encore : à proposer pour le journal. */
export function aInscrire(taches: Tache[], decisions: DecisionExco[]): Tache[] {
  const suivies = new Set(decisions.filter(estOuverte).map((d) => d.tache).filter(Boolean));
  return taches.filter((t) => t.etat === 'a_valider' && t.statut !== 'fait' && !suivies.has(t.id));
}

/** Une décision prise ou refusée libère l'action qui l'attendait : elle n'est plus « À valider ». */
export function appliquerDecision(taches: Tache[], d: DecisionExco): Tache[] {
  if (!d.tache || (d.statut !== 'prise' && d.statut !== 'refusee')) return taches;
  return taches.map((t) => (t.id === d.tache && t.etat === 'a_valider' ? { ...t, etat: undefined } : t));
}
