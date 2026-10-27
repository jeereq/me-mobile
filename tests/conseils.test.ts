import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { conseilsBudgetsObjectifs, moisAvant } from '../src/lib/conseils.ts';
import type { Espace, Finances } from '../src/lib/types.ts';

const d = '2026-10-27';
const espace = (finances: unknown): Espace => ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: {}, majLe: '', finances }) as unknown as Espace;
const dep = (id: string, date: string, montant: number, budget: string | null = 'c') => ({ id, date, montant, note: 'Achat', budget, creeLe: `${date}T10:00` });
const budgetCourses = { id: 'c', nom: 'Courses', emoji: '🛒', montant: 300, periode: 'mois' };
const revenus = ['2026-07', '2026-08', '2026-09'].map((m) => ({ id: `r${m}`, date: `${m}-05`, montant: 2000, note: 'Salaire', creeLe: '' }));
const obj = (x: Record<string, unknown> = {}) => ({ id: 'o', nom: 'Voyage', emoji: '✈️', genre: 'epargne', cible: 1200, debut: '2026-08-27', echeance: '2027-01-27', versements: [], creeLe: '', ...x });
const fin = (x: Record<string, unknown>) => ({ devise: '€', budgets: [budgetCourses], depenses: [], revenus: [], ...x }) as unknown as Finances;
const ids = (f: Finances) => conseilsBudgetsObjectifs(espace(f), d).map((c) => c.id);

describe('mois précédents', () => {
  it('rend le premier jour du mois, n mois avant', () => {
    assert.equal(moisAvant('2026-10-27', 1), '2026-09-01');
    assert.equal(moisAvant('2026-01-15', 1), '2025-12-01');
    assert.equal(moisAvant('2026-03-31', 3), '2025-12-01');
  });
});

describe('budget qui déborde chaque mois', () => {
  const depenses = ['2026-07', '2026-08', '2026-09'].map((m, i) => dep(`d${i}`, `${m}-10`, 400));
  it('signale un budget dépassé trois mois sur trois et propose un montant réaliste', () => {
    const c = conseilsBudgetsObjectifs(espace(fin({ depenses })), d).find((x) => x.id === 'budget-recidive-c');
    assert.ok(c);
    assert.equal(c!.niveau, 'alerte');
    assert.match(c!.titre, /3 mois sur 3/);
    assert.match(c!.texte, /400/);
  });
  it('ne dit rien d’un budget tenu', () => {
    const tenu = ['2026-07', '2026-08', '2026-09'].map((m, i) => dep(`d${i}`, `${m}-10`, 200));
    assert.ok(!ids(fin({ depenses: tenu })).includes('budget-recidive-c'));
  });
  it('ne dit rien avec un seul mois dépassé', () => {
    assert.ok(!ids(fin({ depenses: [dep('a', '2026-09-10', 400), dep('b', '2026-08-10', 100), dep('c2', '2026-07-10', 100)] })).includes('budget-recidive-c'));
  });
});

describe('marge de fin de mois', () => {
  it('propose de verser la marge d’un budget peu utilisé sur l’objectif en retard', () => {
    const c = conseilsBudgetsObjectifs(espace(fin({ depenses: [dep('a', '2026-10-05', 60)], objectifs: [obj()] })), d).find((x) => x.id === 'budget-marge-c');
    assert.ok(c);
    assert.equal(c!.domaine, 'objectif');
    assert.match(c!.texte, /Voyage/);
    assert.match(c!.texte, /en retard/);
  });
  it('se tait en début de mois ou sans objectif', () => {
    assert.ok(!conseilsBudgetsObjectifs(espace(fin({ depenses: [dep('a', '2026-10-05', 60)], objectifs: [obj()] })), '2026-10-10').some((x) => x.id === 'budget-marge-c'));
    assert.ok(!ids(fin({ depenses: [dep('a', '2026-10-05', 60)] })).includes('budget-marge-c'));
  });
  it('se tait quand le budget est déjà bien utilisé', () => {
    assert.ok(!ids(fin({ depenses: [dep('a', '2026-10-05', 250)], objectifs: [obj()] })).includes('budget-marge-c'));
  });
});

describe('plan qui ne tient pas', () => {
  const depenses = ['2026-07', '2026-08', '2026-09'].map((m, i) => dep(`d${i}`, `${m}-10`, 1200));
  it('dit où trouver l’argent ou quelle date tient, et remplace le conseil générique', () => {
    const f = fin({ budgets: [{ ...budgetCourses, montant: 1500 }], depenses, revenus, objectifs: [obj({ plan: { cadence: 'mois', versement: 900 } })] });
    const l = ids(f);
    assert.ok(l.includes('objectif-reduire-o'));
    assert.ok(!l.includes('objectif-tient-pas-o'));
    const c = conseilsBudgetsObjectifs(espace(f), d).find((x) => x.id === 'objectif-reduire-o')!;
    assert.match(c.texte, /Courses/);
  });
});

describe('versement du jour et premier objectif', () => {
  it('rappelle le versement prévu aujourd’hui, sauf s’il est déjà noté', () => {
    assert.ok(ids(fin({ objectifs: [obj()] })).includes('objectif-verser-o'));
    const note = obj({ versements: [{ id: 'v', date: d, montant: 100 }] });
    assert.ok(!ids(fin({ objectifs: [note] })).includes('objectif-verser-o'));
  });
  it('propose un premier objectif quand il reste de l’argent chaque mois', () => {
    const depenses = ['2026-07', '2026-08', '2026-09'].map((m, i) => dep(`d${i}`, `${m}-10`, 500));
    assert.ok(ids(fin({ depenses, revenus })).includes('objectif-premier'));
    assert.ok(!ids(fin({ depenses, revenus, objectifs: [obj()] })).includes('objectif-premier'));
  });
});

describe('ordre', () => {
  it('met les alertes avant les conseils et les infos', () => {
    const depenses = ['2026-07', '2026-08', '2026-09'].map((m, i) => dep(`d${i}`, `${m}-10`, 400));
    const niveaux = conseilsBudgetsObjectifs(espace(fin({ depenses, objectifs: [obj()] })), d).map((c) => c.niveau);
    const rang = (n: string) => ['alerte', 'conseil', 'info', 'bien'].indexOf(n);
    assert.deepEqual([...niveaux].sort((a, b) => rang(a) - rang(b)), niveaux);
  });
});
