import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilan } from '../src/lib/finances.ts';
import { aSurveiller, comparaison, nomPrecedente, partEcoulee, parUrgence, rythme } from '../src/lib/rythme-finances.ts';
import type { Budget, Finances } from '../src/lib/types.ts';

const fin = (budgets: Budget[], depenses: Finances['depenses'] = []): Finances => ({ devise: '$', budgets, depenses });
const dep = (montant: number, date: string, budget: string | null = null) => ({ id: `${date}-${montant}-${budget}`, montant, note: '', budget, date, creeLe: '' });
const courses: Budget = { id: 'c', nom: 'Courses', emoji: '🛒', montant: 280, periode: 'mois' };
const sorties: Budget = { id: 's', nom: 'Sorties', emoji: '🎉', montant: 60, periode: 'mois' };
const D = '2026-10-18';

describe('le rythme du total', () => {
  it('compte la part de la période écoulée, aujourd’hui compris', () => {
    assert.equal(partEcoulee('2026-10-01', '2026-10-31', '2026-09-30'), 0);
    assert.equal(partEcoulee('2026-10-01', '2026-10-31', '2026-10-31'), 1);
    assert.equal(partEcoulee('2026-10-01', '2026-10-31', '2026-11-02'), 1);
    assert.ok(Math.abs(partEcoulee('2026-10-01', '2026-10-31', D) - 18 / 31) < 1e-9);
  });

  it('donne ce qu’il reste et ce qu’on peut dépenser par jour jusqu’à la fin', () => {
    const f = fin([courses, sorties], [dep(150, '2026-10-05', 'c'), dep(30, '2026-10-10', 's')]);
    const r = rythme(bilan(f, 'mois', D, D), D);
    assert.equal(r.reste, 160);
    assert.equal(r.joursRestants, 14);
    assert.equal(r.parJour, 11);
    assert.equal(r.etat, 'rythme');
    assert.ok(r.repere !== null && Math.abs(r.repere - 18 / 31) < 1e-9);
  });

  it('dit quand on dépense plus vite que prévu, et de combien de jours', () => {
    // 340 $ sur 31 jours, soit environ 11 $ par jour : 300 $ le 18 couvrent 27 jours, 9 de plus que prévu.
    const f = fin([courses, sorties], [dep(300, '2026-10-05', 'c')]);
    const r = rythme(bilan(f, 'mois', D, D), D);
    assert.equal(r.etat, 'avance');
    assert.equal(r.avance, 9);
  });

  it('passe au rouge une fois dépassé, et se tait sans budget', () => {
    assert.equal(rythme(bilan(fin([sorties], [dep(80, '2026-10-05', 's')]), 'mois', D, D), D).etat, 'depasse');
    assert.equal(rythme(bilan(fin([], [dep(80, '2026-10-05')]), 'mois', D, D), D).etat, 'sans');
    assert.equal(rythme(bilan(fin([sorties], [dep(10, '2026-09-05', 's')]), 'mois', '2026-09-10', D), D).etat, 'termine');
  });
});

describe('les budgets par urgence', () => {
  it('met d’abord les dépassés, puis ceux qui se vident plus vite que le temps', () => {
    const cafe: Budget = { id: 'k', nom: 'Café', emoji: '☕', montant: 100, periode: 'mois' };
    const f = fin([courses, sorties, cafe], [dep(164, '2026-10-05', 'c'), dep(65, '2026-10-10', 's'), dep(20, '2026-10-12', 'k')]);
    const b = bilan(f, 'mois', D, D);
    assert.deepEqual(parUrgence(b.lignes, D).map((l) => l.budget.id), ['s', 'c', 'k']);
    assert.deepEqual(b.lignes.filter((l) => aSurveiller(l, D)).map((l) => l.budget.id), ['s']);
  });
});

describe('la comparaison avec la période d’avant', () => {
  it('compare à la même date quand la période est en cours', () => {
    const f = fin([courses], [dep(100, '2026-09-10', 'c'), dep(200, '2026-09-25', 'c'), dep(90, '2026-10-05', 'c')]);
    const c = comparaison(f, 'mois', D, D);
    assert.equal(c.memeDate, true);
    assert.equal(c.avant, 100);
    assert.equal(c.ecart, -10);
    assert.equal(c.nom, 'septembre');
  });

  it('compare deux périodes entières une fois finie', () => {
    const f = fin([courses], [dep(100, '2026-08-10', 'c'), dep(150, '2026-09-25', 'c')]);
    const c = comparaison(f, 'mois', '2026-09-10', D);
    assert.equal(c.memeDate, false);
    assert.equal(c.avant, 100);
    assert.equal(c.ecart, 50);
    assert.equal(nomPrecedente('semaine', D), 'la semaine d’avant');
  });
});
