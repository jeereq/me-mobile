import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilan } from '../src/lib/finances.ts';
import { annulerReport, budgetsDepasses, caseDe, erreurTransfert, manque, montantPropose, reportsDeLaPeriode, sourcesTransfert, transferer } from '../src/lib/reports.ts';
import type { Budget, Finances } from '../src/lib/types.ts';

const dep = (montant: number, date: string, budget: string | null = null) => ({ id: `${date}-${montant}-${budget}`, montant, note: '', budget, date, creeLe: '' });
const repas: Budget = { id: 'r', nom: 'Repas', emoji: '🍽️', montant: 20, periode: 'jour' };
const transport: Budget = { id: 't', nom: 'Transport', emoji: '🚗', montant: 10, periode: 'jour' };
const courses: Budget = { id: 'c', nom: 'Courses', emoji: '🛒', montant: 300, periode: 'mois' };
const sorties: Budget = { id: 's', nom: 'Sorties', emoji: '🎉', montant: 50, periode: 'semaine' };
const global: Budget = { id: 'g', nom: 'Tout', emoji: '💰', montant: 1000, periode: 'mois', global: true };

// Mardi 27 octobre 2026 : 25 € de repas pour 20 prévus, 2 € de transport, 100 € de courses depuis le début du mois.
const mardi = '2026-10-27';
const mercredi = '2026-10-28';
const f: Finances = { devise: '€', budgets: [repas, transport, courses, sorties, global], depenses: [dep(25, mardi, 'r'), dep(2, mardi, 't'), dep(100, '2026-10-05', 'c'), dep(60, '2026-10-26', 's')] };
const versRepas = caseDe('r', 'jour', mardi);
const deCourses = caseDe('c', 'mois', mardi);

describe('budgets dépassés', () => {
  it('trouve le budget du jour dépassé, pas le budget global', () => {
    assert.deepEqual(budgetsDepasses(f, 'jour', mardi, mardi).map((x) => [x.budget.id, x.depasse]), [['r', 5]]);
    assert.equal(manque(f, versRepas), 5);
  });
  it('ne propose rien sur une période à venir', () => {
    assert.equal(budgetsDepasses(f, 'jour', mercredi, mardi).length, 0);
  });
});

describe('budgets qui peuvent donner', () => {
  it('les autres budgets avec un reste, chacun sur sa période, sans le global ni un budget dépassé', () => {
    assert.deepEqual(sourcesTransfert(f, versRepas).map((x) => [x.budget.id, x.reste, x.case.periode, x.case.debut]), [
      ['c', 200, 'mois', '2026-10-01'],
      ['t', 8, 'jour', mardi],
    ]);
  });
  it('un budget plus court ne comble pas un budget plus long', () => {
    const versSorties = caseDe('s', 'semaine', mardi);
    assert.deepEqual(sourcesTransfert(f, versSorties).map((x) => x.budget.id), ['c']);
  });
  it('propose de quoi combler le dépassement, sans dépasser le reste de la source', () => {
    assert.equal(montantPropose(f, deCourses, versRepas), 5);
    const g = { ...f, depenses: [...f.depenses, dep(9, mardi, 'r')] };
    assert.equal(montantPropose(g, caseDe('t', 'jour', mardi), versRepas), 8);
  });
  it('refuse plus que le reste, un montant vide ou le même budget', () => {
    assert.match(erreurTransfert(f, caseDe('t', 'jour', mardi), versRepas, 9) ?? '', /Il ne reste que 8/);
    assert.match(erreurTransfert(f, deCourses, versRepas, null) ?? '', /montant/);
    assert.match(erreurTransfert(f, versRepas, versRepas, 5) ?? '', /autre budget/);
    assert.equal(erreurTransfert(f, deCourses, versRepas, 5), null);
  });
});

describe('transférer de Courses vers Repas', () => {
  const g = transferer(f, deCourses, versRepas, 5, 'x1');
  it('comble le budget dépassé et baisse la source du même montant', () => {
    const jour = bilan(g, 'jour', mardi, mardi).lignes.find((l) => l.budget.id === 'r')!;
    assert.equal(jour.plafond, 25);
    assert.equal(jour.reste, 0);
    const mois = bilan(g, 'mois', mardi, mardi).lignes.find((l) => l.budget.id === 'c')!;
    assert.equal(mois.plafond, 295);
    assert.equal(budgetsDepasses(g, 'jour', mardi, mardi).length, 0);
  });
  it('ne change pas ce qui est prévu sur le mois : l’argent passe d’un budget à l’autre', () => {
    const somme = (h: Finances) => bilan(h, 'mois', mardi, mardi).lignes.filter((l) => !l.budget.global).reduce((s, l) => s + l.plafond, 0);
    assert.equal(Math.round(somme(g) * 100), Math.round(somme(f) * 100));
  });
  it('ne touche pas aux autres jours', () => {
    assert.equal(bilan(g, 'jour', mercredi, mardi).lignes.find((l) => l.budget.id === 'r')?.plafond, 20);
  });
  it('se voit comme reçu sur le jour, comme transfert sur le mois', () => {
    assert.deepEqual(reportsDeLaPeriode(g, mardi, mardi).map((x) => x.sens), ['recu']);
    assert.deepEqual(reportsDeLaPeriode(g, mercredi, mercredi).length, 0);
    const m = reportsDeLaPeriode(g, '2026-10-01', '2026-10-31');
    assert.deepEqual(m.map((x) => x.sens), ['transfert']);
    assert.match(m[0].titre, /Courses vers .*Repas/);
  });
  it('s’annule', () => {
    assert.equal(bilan(annulerReport(g, 'x1'), 'jour', mardi, mardi).lignes.find((l) => l.budget.id === 'r')?.reste, -5);
  });
});
