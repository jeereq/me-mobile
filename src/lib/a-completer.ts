import type { Plan } from './planning';
import type { Projet, Tache } from './types';

/** Ce qui manque à une action pour être suivie sérieusement. */
export type Manque = 'responsable' | 'budget' | 'date';
export const MANQUES: { cle: Manque; nom: string; aide: string }[] = [
  { cle: 'responsable', nom: 'Responsable', aide: 'Personne n\'en est chargé' },
  { cle: 'budget', nom: 'Budget', aide: 'Aucun montant prévu' },
  { cle: 'date', nom: 'Date', aide: 'Ni échéance, ni lien, ni début imposé : le planning la place au hasard' },
];

export type ActionIncomplete = { tache: Tache; projet: Projet; manques: Manque[] };
export type Completer = { actions: ActionIncomplete[]; /** Nombre d'actions auxquelles manque chaque information. */ parManque: Record<Manque, number>; /** Actions à faire en tout (celles qui sont finies ne comptent pas). */ nbActions: number };

/**
 * Les actions à faire auxquelles il manque un responsable, un budget ou une date.
 * Les tâches finies et les « résumés » (leurs sous-tâches comptent) sont laissés de côté.
 * Les plus incomplètes d'abord, puis dans l'ordre des projets.
 */
export function aCompleter(entrees: { projet: Projet; plan: Plan; taches: Tache[] }[]): Completer {
  const actions: ActionIncomplete[] = [];
  const parManque: Record<Manque, number> = { responsable: 0, budget: 0, date: 0 };
  let nbActions = 0;
  for (const { projet, plan, taches } of entrees)
    for (const t of taches) {
      const l = plan.lignes.get(t.id);
      if (!l || l.resume || l.fait) continue;
      nbActions++;
      const manques: Manque[] = [];
      if (!t.responsable?.trim() && !t.affecteA) manques.push('responsable');
      if (t.budget === undefined) manques.push('budget');
      // Une date, c'est une échéance, un début imposé, ou un lien qui la fixe.
      if (!t.fixe && !t.echeance && !t.apres?.length) manques.push('date');
      for (const m of manques) parManque[m]++;
      if (manques.length) actions.push({ tache: t, projet, manques });
    }
  const rang = new Map(entrees.map((e, i) => [e.projet.id, i]));
  actions.sort((a, b) => b.manques.length - a.manques.length || rang.get(a.projet.id)! - rang.get(b.projet.id)! || (a.tache.ordre ?? 0) - (b.tache.ordre ?? 0));
  return { actions, parManque, nbActions };
}
