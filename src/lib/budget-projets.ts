import type { Plan } from './planning';
import type { Tache } from './types';

/**
 * Le budget d'un projet : la somme des budgets de ses tâches (les tâches « résumé » n'en ont pas : leurs sous-tâches comptent, une seule fois).
 * Les montants sont dans la devise principale.
 */
export type BudgetProjet = {
  prevu: number;
  engage: number;
  /** Ce qui reste à engager : peut être négatif si l'engagé dépasse le prévu. */
  reste: number;
  depasse: boolean;
  /** Tâches à faire qui n'ont pas encore de budget. */
  sansBudget: number;
  /** Au moins une tâche a un budget. */
  renseigne: boolean;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

export function budgetProjet(taches: Tache[], plan: Plan): BudgetProjet {
  let prevu = 0;
  let engage = 0;
  let sansBudget = 0;
  let renseigne = false;
  for (const t of taches) {
    const l = plan.lignes.get(t.id);
    if (!l || l.resume) continue;
    if (t.budget !== undefined) renseigne = true;
    else if (!l.fait) sansBudget++;
    prevu += t.budget ?? 0;
    engage += t.engage ?? 0;
  }
  prevu = arrondi(prevu);
  engage = arrondi(engage);
  return { prevu, engage, reste: arrondi(prevu - engage), depasse: engage > prevu && engage > 0, sansBudget, renseigne: renseigne || engage > 0 };
}

export const sommeBudgets = (l: BudgetProjet[]): BudgetProjet =>
  l.reduce<BudgetProjet>(
    (s, b) => ({ prevu: arrondi(s.prevu + b.prevu), engage: arrondi(s.engage + b.engage), reste: arrondi(s.reste + b.reste), depasse: s.depasse || b.depasse, sansBudget: s.sansBudget + b.sansBudget, renseigne: s.renseigne || b.renseigne }),
    { prevu: 0, engage: 0, reste: 0, depasse: false, sansBudget: 0, renseigne: false },
  );

/** « 8 500 $ » ; « 1,2 k$ » serait ambigu, on garde le montant entier. */
export const fmtSomme = (n: number, devise = '$') => `${Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ')} ${devise}`;

/** Lit ce que l'utilisateur tape (« 8 500 », « 1250,50 ») ; null pour vide ou invalide, ce qui efface le montant. */
export function lireSaisie(s: string): number | null {
  const t = s.replace(/[\s  ]/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n < 1e12 ? arrondi(n) : null;
}
