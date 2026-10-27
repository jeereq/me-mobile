import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { budgetParMois, budgetsDuMois, joursDeLaPeriode, moisTenus, titrePeriode, verseParMois } from '../src/lib/stats-budget.ts';
import type { Espace } from '../src/lib/types.ts';

const d = '2026-10-27';
const espace = (finances: unknown): Espace => ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: {}, majLe: '', finances }) as unknown as Espace;
const dep = (id: string, date: string, montant: number, budget: string | null) => ({ id, date, montant, note: 'x', budget, creeLe: `${date}T10:00` });
const total = { id: 'g', nom: 'Total', emoji: '💰', montant: 1000, periode: 'mois', global: true };
const courses = { id: 'c', nom: 'Courses', emoji: '🛒', montant: 300, periode: 'mois' };

describe('périodes', () => {
  it('compte les jours depuis le début du mois ou de l’année', () => {
    assert.equal(joursDeLaPeriode('mois', '2026-10-27'), 27);
    assert.equal(joursDeLaPeriode('annee', '2026-01-01'), 1);
    assert.equal(joursDeLaPeriode('annee', '2026-03-01'), 60);
    assert.equal(joursDeLaPeriode('30', '2026-10-27'), 30);
  });
  it('titre la période', () => {
    assert.equal(titrePeriode('mois', 27), 'Ce mois');
    assert.equal(titrePeriode('90', 90), 'Les 90 derniers jours');
  });
});

describe('budget mois par mois', () => {
  const f = { devise: '€', budgets: [total, courses], depenses: [dep('a', '2026-09-10', 1200, null), dep('b', '2026-08-10', 800, null), dep('c', '2026-10-03', 100, 'c')], revenus: [] };
  it('dit si le plafond a tenu chaque mois', () => {
    const l = budgetParMois(espace(f), d, 3);
    assert.deepEqual(l.map((m) => m.axe), ['août', 'sept.', 'oct.']);
    assert.deepEqual(l.map((m) => m.tenu), [true, false, true]);
    assert.equal(l[1].ratio, 1.2);
    assert.deepEqual(moisTenus(l), { tenus: 2, sur: 3 });
  });
  it('ne compte pas comme tenus les mois d’avant la première dépense', () => {
    const l = budgetParMois(espace(f), d, 6);
    assert.deepEqual(l.map((m) => m.fixe), [false, false, false, true, true, true]);
  });
  it('ne juge pas un mois sans budget fixé', () => {
    const l = budgetParMois(espace({ devise: '€', budgets: [], depenses: [], revenus: [] }), d, 2);
    assert.ok(l.every((m) => !m.fixe && !m.tenu));
    assert.deepEqual(moisTenus(l), { tenus: 0, sur: 0 });
  });
  it('classe les budgets du mois du plus utilisé au moins utilisé, sans le total', () => {
    const l = budgetsDuMois(espace({ ...f, budgets: [total, courses, { id: 'l', nom: 'Loisirs', emoji: '🎬', montant: 100, periode: 'mois' }], depenses: [dep('a', '2026-10-03', 250, 'c'), dep('b', '2026-10-04', 90, 'l')] }), d);
    assert.deepEqual(l.map((x) => x.id), ['l', 'c']);
    assert.equal(l[1].reste, 50);
  });
});

describe('versé par mois', () => {
  it('additionne les versements des objectifs en cours, mois par mois', () => {
    const o = (id: string, versements: unknown[], archive?: boolean) => ({ id, nom: id, emoji: '🎯', genre: 'epargne', cible: 1000, debut: '2026-01-01', echeance: '2027-01-01', versements, creeLe: '', archive });
    const f = { devise: '€', budgets: [], depenses: [], revenus: [], objectifs: [o('a', [{ id: '1', date: '2026-10-05', montant: 100 }, { id: '2', date: '2026-09-05', montant: 50 }]), o('b', [{ id: '3', date: '2026-10-20', montant: 25 }]), o('z', [{ id: '4', date: '2026-10-01', montant: 999 }], true)] };
    const l = verseParMois(espace(f), d, 3);
    assert.deepEqual(l.map((m) => m.v), [0, 50, 125]);
  });
});
