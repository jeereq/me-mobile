import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilan, budgetDuJour, epargneEntre } from '../src/lib/finances.ts';
import { capaciteMensuelle } from '../src/lib/objectifs.ts';
import { statsFinances } from '../src/lib/stats-finances.ts';
import type { Budget, Finances } from '../src/lib/types.ts';

const dep = (id: string, montant: number, date: string, x: Partial<Finances['depenses'][number]> = {}) => ({ id, montant, note: '', budget: null, date, creeLe: '', ...x });
const courses: Budget = { id: 'c', nom: 'Courses', emoji: '🛒', montant: 200, periode: 'mois' };
const sorties: Budget = { id: 's', nom: 'Sorties', emoji: '🎉', montant: 70, periode: 'semaine' };

describe('les finances disent la même chose partout', () => {
  it('un versement vers un objectif est mis de côté, pas dépensé', () => {
    const f: Finances = {
      devise: '$',
      budgets: [courses],
      depenses: [dep('d1', 50, '2026-10-10', { budget: 'c' }), dep('ep', 100, '2026-10-15')],
      revenus: [{ id: 'r', montant: 800, note: 'Salaire', date: '2026-10-01', creeLe: '' }],
      objectifs: [{ id: 'o', nom: 'Voyage', emoji: '✈️', genre: 'epargne', cible: 1000, debut: '2026-09-01', echeance: '2027-03-01', versements: [{ id: 'dep:ep', date: '2026-10-15', montant: 100, depense: 'ep' }], creeLe: '' }],
    };
    const b = bilan(f, 'mois', '2026-10-20', '2026-10-20');
    assert.equal(b.total, 50);
    assert.equal(b.horsBudget, 0, 'l’épargne ne gonfle pas le hors budget');
    assert.deepEqual(epargneEntre(f, b.debut, b.fin), { nb: 1, total: 100 });
    assert.equal(capaciteMensuelle(f, '2026-11-05')?.depenses, 50, 'les objectifs voient la même dépense');
  });

  it('un budget à la semaine donne son budget du jour sur la semaine', () => {
    // Lundi 26 octobre : 70 € pour la semaine, 7 jours → 10 € ; mardi, après 40 € lundi : 30 € sur 6 jours → 5 €.
    const f: Finances = { devise: '€', budgets: [sorties], depenses: [dep('x', 40, '2026-10-26', { budget: 's' })] };
    assert.equal(budgetDuJour(f, '2026-10-26'), 10);
    assert.equal(budgetDuJour(f, '2026-10-27'), 5);
  });

  it('« budget tenu » compare au plafond ce qui compte dans les budgets, sans le hors budget', () => {
    // Septembre : 150 dans Courses (budget 200) et 300 de loyer hors budget : le budget est tenu.
    const f: Finances = { devise: '€', budgets: [courses], depenses: [dep('a', 150, '2026-09-10', { budget: 'c' }), dep('l', 300, '2026-09-01'), dep('b', 20, '2026-10-05', { budget: 'c' })] };
    const s = statsFinances(f, 'mois', '2026-10-20', '2026-10-20');
    assert.deepEqual(s.respect, { tenues: 1, sur: 1 });
  });
});
