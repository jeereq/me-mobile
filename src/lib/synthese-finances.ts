import { idBudgetDe } from './categories';
import { totauxPrets, suiviPret } from './commun/prets';
import { revenusEntre, totalRevenus, type Bilan } from './finances';
import { parUrgence } from './rythme-finances';
import type { Finances } from './types';

const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * Budgets, prêts, dépenses et revenus d'une période sur un seul écran. Module pur, testé dans tests/synthese-finances.test.ts.
 * Reprend les calculs de l'onglet Aperçu : les deux vues disent toujours la même chose.
 */
export function syntheseFinances(f: Finances, b: Bilan, d: string) {
  const revenus = revenusEntre(f, b.debut, b.fin);
  const totalR = totalRevenus(revenus);

  // Les dépenses par budget, les plus grosses d'abord.
  const parBudget = new Map<string, number>();
  for (const x of b.depenses) {
    const id = idBudgetDe(f.budgets, x) ?? '';
    parBudget.set(id, (parBudget.get(id) ?? 0) + x.montant);
  }
  const postes = [...parBudget]
    .map(([id, montant]) => {
      const bu = f.budgets.find((y) => y.id === id);
      return { id, nom: bu?.nom ?? 'Hors budget', emoji: bu?.emoji ?? '💸', montant: arrondi(montant) };
    })
    .sort((x, y) => y.montant - x.montant);

  // Le budget total est déjà dans le chiffre global : la liste montre les autres, sauf s'il est seul.
  const lignes = b.lignes.filter((l) => !l.budget.global || b.lignes.length === 1);

  const prets = (f.prets ?? []).filter((p) => !p.archive);
  const ouverts = prets.filter((p) => suiviPret(p, d).etat !== 'rembourse');
  const totaux = totauxPrets(prets, d);
  const prochain = ouverts.filter((p) => p.echeance).sort((x, y) => (x.echeance ?? '').localeCompare(y.echeance ?? ''))[0] ?? null;

  return {
    solde: arrondi(totalR - b.total),
    revenus: { total: totalR, nb: revenus.length, principaux: [...revenus].sort((x, y) => y.montant - x.montant).slice(0, 3) },
    depenses: { total: b.total, nb: b.depenses.length, postes: postes.slice(0, 3) },
    budgets: {
      nb: lignes.length,
      plafond: b.plafondTotal,
      compte: b.compte,
      reste: arrondi(b.plafondTotal - b.compte),
      ratio: b.plafondTotal ? b.compte / b.plafondTotal : 0,
      depasses: lignes.filter((l) => l.reste < 0).length,
      pressants: parUrgence(lignes, d).slice(0, 3),
    },
    prets: { ...totaux, nb: ouverts.length, prochain },
  };
}
