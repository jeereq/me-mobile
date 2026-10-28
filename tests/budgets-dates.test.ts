import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { budgetDe } from '../src/lib/categories.ts';
import { bilan, etatBudget, fenetre, genererRecurrences, suiviBudget } from '../src/lib/finances.ts';
import { prevision } from '../src/lib/previsions.ts';
import type { Budget, Finances } from '../src/lib/types.ts';

const fin = (budgets: Budget[], depenses: Finances['depenses'] = []): Finances => ({ devise: '€', budgets, depenses });
const dep = (montant: number, date: string, x: Partial<Finances['depenses'][number]> = {}) => ({ id: `${date}-${montant}`, montant, note: '', budget: null, date, creeLe: '', ...x });

describe('budgets jusqu’à une date', () => {
  const envel: Budget = { id: 'e', nom: 'Travaux', emoji: '🔨', montant: 600, periode: 'mois', debut: '2026-11-01', fin: '2026-11-30', enveloppe: true };
  it('suit une enveloppe sur toute sa durée, sans la répartir par jour', () => {
    assert.deepEqual(fenetre(envel, '2026-11-10'), { debut: '2026-11-01', fin: '2026-11-30' });
    assert.equal(bilan(fin([envel]), 'jour', '2026-11-10', '2026-11-10').lignes[0].plafond, 600);
    assert.equal(fenetre(envel, '2026-12-01'), null);
  });
  it('arrête un budget périodique à sa date de fin, sans le proratiser', () => {
    const b: Budget = { id: 'c', nom: 'Courses', emoji: '🛒', montant: 300, periode: 'mois', fin: '2026-11-15' };
    assert.deepEqual(fenetre(b, '2026-11-10'), { debut: '2026-11-01', fin: '2026-11-15' });
    assert.deepEqual(fenetre(b, '2026-10-10'), { debut: '2026-10-01', fin: '2026-10-31' });
  });
  it('donne l’état d’un budget daté', () => {
    assert.equal(etatBudget(envel, '2026-10-20'), 'a_venir');
    assert.equal(etatBudget(envel, '2026-11-20'), 'en_cours');
    assert.equal(etatBudget(envel, '2026-12-01'), 'termine');
  });
  it('suit ce qui reste d’une enveloppe jusqu’à la fin', () => {
    const f = fin([envel], [dep(150, '2026-11-05', { budget: 'e' }), dep(40, '2026-10-30', { budget: 'e' })]);
    const s = suiviBudget(f, envel, '2026-11-11');
    assert.equal(s?.depense, 150);
    assert.equal(s?.reste, 450);
  });
  it('retire du bilan un budget terminé', () => {
    const b: Budget = { id: 'v', nom: 'Vacances', emoji: '🏖️', montant: 300, periode: 'mois', fin: '2026-10-31' };
    assert.equal(bilan(fin([b]), 'mois', '2026-11-10', '2026-11-10').lignes.length, 0);
    assert.equal(bilan(fin([b]), 'mois', '2026-10-10', '2026-11-10').lignes.length, 1);
  });
  it('ne range par catégorie que pendant les dates du budget', () => {
    const b: Budget = { id: 'r', nom: 'Restos', emoji: '🍽️', montant: 100, periode: 'mois', categories: ['sortie'], fin: '2026-10-31' };
    assert.equal(budgetDe([b], { budget: null, categories: ['sortie'], date: '2026-10-20' })?.id, 'r');
    assert.equal(budgetDe([b], { budget: null, categories: ['sortie'], date: '2026-11-02' }) ?? null, null);
  });
  it('range une enveloppe parmi les budgets de sa durée, tout son montant', () => {
    assert.equal(prevision(fin([envel]), 'mois', '2026-11-10')?.plafond, 600);
    assert.equal(prevision(fin([envel]), 'semaine', '2026-11-10'), null);
  });
});

describe('paiements qui reviennent jusqu’à une date', () => {
  it('s’arrêtent à leur date de fin', () => {
    const f: Finances = { ...fin([]), recurrences: [{ id: 'r', genre: 'depense', montant: 10, note: 'Abonnement', budget: null, frequence: 'mois', debut: '2026-08-05', derniere: null, fin: '2026-09-30' }] };
    const g = genererRecurrences(f, '2026-11-10');
    assert.deepEqual(g.depenses.map((x) => x.date).sort(), ['2026-08-05', '2026-09-05']);
  });
});
