import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilan, suiviBudget, usageBudget } from '../src/lib/finances.ts';
import { prevision } from '../src/lib/previsions.ts';
import type { Budget, Finances } from '../src/lib/types.ts';

const fin = (budgets: Budget[], depenses: Finances['depenses'] = []): Finances => ({ devise: '€', budgets, depenses });
const dep = (montant: number, date: string, x: Partial<Finances['depenses'][number]> = {}) => ({ id: `${date}-${montant}-${x.budget ?? ''}`, montant, note: '', budget: null, date, creeLe: '', ...x });
const courses: Budget = { id: 'c', nom: 'Courses', emoji: '🛒', montant: 300, periode: 'mois' };

describe('un budget se compte sur les dépenses notées, rien de supposé', () => {
  const f = fin([courses], [dep(100, '2026-11-05', { budget: 'c' }), dep(20, '2026-11-11', { budget: 'c' })]);

  it('reste = montant moins les dépenses notées sur sa période', () => {
    const l = bilan(f, 'mois', '2026-11-11', '2026-11-11').lignes[0];
    assert.deepEqual([l.plafond, l.depense, l.reste], [300, 120, 180]);
  });
  it('n’entre pas dans la vue Jour ni Semaine : pas de budget du jour tiré du mois', () => {
    for (const vue of ['jour', 'semaine'] as const) assert.equal(bilan(f, vue, '2026-11-11', '2026-11-11').lignes.length, 0);
  });
  it('additionne un budget par jour sur la semaine et sur le mois', () => {
    const cafe: Budget = { id: 'k', nom: 'Café', emoji: '☕', montant: 5, periode: 'jour' };
    const g = fin([cafe, courses], [dep(4, '2026-11-09', { budget: 'k' }), dep(7, '2026-11-11', { budget: 'k' }), dep(100, '2026-11-05', { budget: 'c' })]);
    const jour = bilan(g, 'jour', '2026-11-11', '2026-11-11');
    assert.deepEqual(jour.lignes.map((l) => [l.budget.id, l.plafond, l.depense, l.reste]), [['k', 5, 7, -2]]);
    const semaine = bilan(g, 'semaine', '2026-11-11', '2026-11-11');
    assert.deepEqual(semaine.lignes.map((l) => [l.budget.id, l.plafond, l.depense, l.reste, l.nb]), [['k', 35, 11, 24, 7]]);
    const mois = bilan(g, 'mois', '2026-11-11', '2026-11-11');
    assert.deepEqual(mois.lignes.map((l) => [l.budget.id, l.plafond, l.depense]), [['k', 150, 11], ['c', 300, 100]]);
    assert.equal(mois.compte, 111);
  });
  it('ne projette rien jusqu’à la fin du mois', () => {
    // 290 notés dès le 2 : l'ancien calcul annonçait un dépassement « à ce rythme ». Tant que c'est sous 300, tout va bien.
    const g = fin([courses], [dep(290, '2026-11-02', { budget: 'c' })]);
    assert.equal(prevision(g, 'mois', '2026-11-02')?.etat, 'ok');
    assert.equal(prevision(g, 'mois', '2026-11-02', 0.8)?.etat, 'risque');
    assert.equal(prevision(g, 'jour', '2026-11-02'), null, 'pas de budget du jour tiré du budget au mois');
  });
  it('un budget de 40 $ pour un besoin : 40 moins ce qui y est noté, le reste n’y compte pas', () => {
    const besoin: Budget = { id: 'n', nom: 'Cadeau', emoji: '🎁', montant: 40, periode: 'mois', debut: '2026-11-01', fin: '2026-11-30', enveloppe: true };
    const g = fin([besoin], [dep(15, '2026-11-04', { budget: 'n' }), dep(99, '2026-11-05')]);
    assert.deepEqual(suiviBudget(g, besoin, '2026-11-20'), { debut: '2026-11-01', fin: '2026-11-30', total: 40, depense: 15, reste: 25 });
    assert.equal(bilan(g, 'semaine', '2026-11-20', '2026-11-20').lignes[0].reste, 25);
    assert.equal(usageBudget(g, besoin, '2026-11-20'), 15 / 40);
  });
  it('donne le montant fixé pour un budget par jour, sur sa journée', () => {
    const g = fin([{ id: 'g', nom: 'Budget du jour', emoji: '💰', montant: 25, periode: 'jour', global: true }], [dep(40, '2026-11-10')]);
    assert.equal(prevision(g, 'jour', '2026-11-11')?.plafond, 25);
    assert.equal(prevision(g, 'jour', '2026-11-10')?.etat, 'depasse');
  });
  it('compte un budget à la semaine sur sa semaine, et sur le mois les semaines qui y commencent', () => {
    const sorties: Budget = { id: 's', nom: 'Sorties', emoji: '🎉', montant: 70, periode: 'semaine' };
    const g = fin([sorties], [dep(40, '2026-10-26', { budget: 's' })]);
    const l = bilan(g, 'semaine', '2026-10-28', '2026-10-28').lignes[0];
    assert.deepEqual([l.debut, l.fin, l.plafond, l.reste], ['2026-10-26', '2026-11-01', 70, 30]);
    // Octobre 2026 : semaines du 5, 12, 19 et 26.
    const m = bilan(g, 'mois', '2026-10-28', '2026-10-28').lignes[0];
    assert.deepEqual([m.debut, m.fin, m.plafond, m.depense, m.nb], ['2026-10-05', '2026-11-01', 280, 40, 4]);
  });
  it('garde tout le montant d’un budget qui s’arrête en cours de mois', () => {
    const b: Budget = { ...courses, fin: '2026-11-15' };
    const l = bilan(fin([b]), 'mois', '2026-11-10', '2026-11-10').lignes[0];
    assert.deepEqual([l.plafond, l.fin], [300, '2026-11-15']);
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
