import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilan, budgetDuJour } from '../src/lib/finances.ts';
import { prevision } from '../src/lib/previsions.ts';
import type { Budget, Finances } from '../src/lib/types.ts';

const fin = (budgets: Budget[], depenses: Finances['depenses'] = []): Finances => ({ devise: '€', budgets, depenses });
const dep = (montant: number, date: string, x: Partial<Finances['depenses'][number]> = {}) => ({ id: `${date}-${montant}-${x.budget ?? ''}`, montant, note: '', budget: null, date, creeLe: '', ...x });
const courses: Budget = { id: 'c', nom: 'Courses', emoji: '🛒', montant: 300, periode: 'mois' };

describe('un seul budget du jour', () => {
  // Novembre : 30 jours. Le 11, il reste 20 jours, aujourd'hui compris.
  const f = fin([courses], [dep(100, '2026-11-05', { budget: 'c' }), dep(20, '2026-11-11', { budget: 'c' })]);

  it('répartit ce qui reste du mois sur les jours restants, sans compter la dépense du jour', () => {
    assert.equal(budgetDuJour(f, '2026-11-11'), 10);
  });
  it('donne le même chiffre dans la vue Jour, l’Aperçu et les Prévisions', () => {
    assert.equal(bilan(f, 'jour', '2026-11-11', '2026-11-11').plafondTotal, 10);
    assert.equal(bilan(f, 'mois', '2026-11-11', '2026-11-11').parJour, 10);
    assert.equal(prevision(f, 'jour', '2026-11-11')?.plafond, 10);
  });
  it('donne le montant fixé pour un budget par jour', () => {
    const g = fin([{ id: 'g', nom: 'Budget du jour', emoji: '💰', montant: 25, periode: 'jour', global: true }], [dep(40, '2026-11-10')]);
    assert.equal(budgetDuJour(g, '2026-11-11'), 25);
  });
  it('propose pour demain ce qui reste une fois la dépense du jour retirée', () => {
    // 300 − 120 = 180 sur les 19 jours du 12 au 30.
    assert.equal(prevision(f, 'jour', '2026-11-11')?.parJour, 9.47);
  });
});

describe('hors budget', () => {
  it('ne mange pas la somme des budgets de catégorie', () => {
    const f = fin([courses], [dep(100, '2026-11-05', { budget: 'c' }), dep(50, '2026-11-06')]);
    const b = bilan(f, 'mois', '2026-11-11', '2026-11-11');
    assert.equal(b.total, 150);
    assert.equal(b.horsBudget, 50);
    assert.equal(b.compte, 100);
    assert.equal(prevision(f, 'mois', '2026-11-11')?.depense, 100);
  });
  it('compte tout face à un budget global', () => {
    const g: Budget = { id: 'g', nom: 'Budget total', emoji: '💰', montant: 1000, periode: 'mois', global: true };
    const f = fin([g, courses], [dep(100, '2026-11-05', { budget: 'c' }), dep(50, '2026-11-06')]);
    assert.equal(bilan(f, 'mois', '2026-11-11', '2026-11-11').compte, 150);
  });
});
