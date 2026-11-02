import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilan } from '../src/lib/finances.ts';
import { syntheseFinances } from '../src/lib/synthese-finances.ts';
import type { Budget, Finances } from '../src/lib/types.ts';

const J = '2026-11-15';
const courses: Budget = { id: 'c', nom: 'Courses', emoji: '🛒', montant: 100, periode: 'mois' };
const loyer: Budget = { id: 'l', nom: 'Loyer', emoji: '🏠', montant: 50, periode: 'mois' };
const dep = (id: string, montant: number, budget: string | null, date = '2026-11-10') => ({ id, montant, note: id, budget, date, creeLe: date });
const rev = (id: string, montant: number, date = '2026-11-01') => ({ id, montant, note: id, date, creeLe: date });

const base: Finances = {
  devise: '$',
  budgets: [courses, loyer],
  depenses: [dep('a', 30, 'c'), dep('b', 80, 'l'), dep('h', 5, null), dep('avant', 999, 'c', '2026-10-10')],
  revenus: [rev('petit', 100), rev('salaire', 500), rev('ancien', 700, '2026-10-01')],
  prets: [
    { id: 'p1', sens: 'prete', personne: 'Paul', montant: 40, date: '2026-10-01', echeance: '2026-11-20', remboursements: [{ id: 'x', date: '2026-11-01', montant: 10 }] },
    { id: 'p2', sens: 'emprunte', personne: 'Ana', montant: 15, date: '2026-10-01', echeance: '2026-11-01' },
    { id: 'p3', sens: 'prete', personne: 'Rendu', montant: 20, date: '2026-10-01', remboursements: [{ id: 'y', date: '2026-11-02', montant: 20 }] },
    { id: 'p4', sens: 'prete', personne: 'Archive', montant: 500, date: '2026-10-01', archive: true },
  ],
} as Finances;

const synthese = (f: Finances = base) => syntheseFinances(f, bilan(f, 'mois', J, J), J);

describe('vue Résumé des finances', () => {
  it('reprend les revenus et les dépenses de la période seulement', () => {
    const s = synthese();
    assert.equal(s.revenus.total, 600);
    assert.equal(s.depenses.total, 115);
    assert.equal(s.solde, 485);
  });
  it('dit la même chose que le bilan', () => {
    const b = bilan(base, 'mois', J, J);
    const s = syntheseFinances(base, b, J);
    assert.equal(s.depenses.total, b.total);
    assert.equal(s.budgets.plafond, b.plafondTotal);
    assert.equal(s.budgets.compte, b.compte);
  });
  it('montre les plus gros revenus et les plus gros postes d’abord, hors budget compris', () => {
    const s = synthese();
    assert.deepEqual(s.revenus.principaux.map((x) => x.id), ['salaire', 'petit']);
    assert.deepEqual(s.depenses.postes.map((x) => [x.nom, x.montant]), [['Loyer', 80], ['Courses', 30], ['Hors budget', 5]]);
  });
  it('compte les budgets dépassés et ce qui reste', () => {
    const s = synthese();
    assert.equal(s.budgets.nb, 2);
    assert.equal(s.budgets.depasses, 1);
    assert.equal(s.budgets.plafond, 150);
    assert.equal(s.budgets.reste, 40);
    assert.equal(s.budgets.pressants[0].budget.id, 'l');
  });
  it('résume les prêts ouverts, sans les archivés', () => {
    const { prets: p } = synthese();
    assert.equal(p.onMeDoit, 30);
    assert.equal(p.jeDois, 15);
    assert.equal(p.net, 15);
    assert.equal(p.nb, 2);
    assert.equal(p.enRetard, 1);
    assert.equal(p.prochain?.personne, 'Ana');
  });
  it('tient sans aucune donnée', () => {
    const s = synthese({ devise: '$', budgets: [], depenses: [] } as Finances);
    assert.equal(s.solde, 0);
    assert.equal(s.budgets.ratio, 0);
    assert.equal(s.prets.nb, 0);
    assert.equal(s.prets.prochain, null);
    assert.deepEqual(s.depenses.postes, []);
  });
});
