import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilan, budgetDuJour } from '../src/lib/finances.ts';
import { suiviObjectif, retirerVersement } from '../src/lib/objectifs.ts';
import { prevision } from '../src/lib/previsions.ts';
import { annulerReport, arriveesProposees, caseDe, erreurReport, reportsDeLaPeriode, reporter, restesReportables } from '../src/lib/reports.ts';
import type { Budget, Finances, Objectif } from '../src/lib/types.ts';

const dep = (montant: number, date: string, budget: string | null = null) => ({ id: `${date}-${montant}`, montant, note: '', budget, date, creeLe: '' });
const parJour: Budget = { id: 'g', nom: 'Budget du jour', emoji: '💰', montant: 20, periode: 'jour', global: true };
const voyage: Objectif = { id: 'o', nom: 'Voyage', emoji: '✈️', genre: 'epargne', cible: 500, debut: '2026-10-01', echeance: '2027-06-01', versements: [], creeLe: '' };
const fin = (budgets: Budget[], depenses: Finances['depenses'] = []): Finances => ({ devise: '€', budgets, depenses, objectifs: [voyage] });

// Mardi 27 octobre 2026 : 12 € dépensés sur 20, il reste 8 €.
const lundi = '2026-10-26';
const mardi = '2026-10-27';
const mercredi = '2026-10-28';
const f = fin([parJour], [dep(12, mardi)]);
const deMardi = caseDe('g', 'jour', mardi);

describe('reste à reporter', () => {
  it('propose le reste d’un jour passé ou en cours', () => {
    assert.deepEqual(restesReportables(f, 'jour', mardi, mardi).map((x) => x.reste), [8]);
  });
  it('ne propose rien pour un jour à venir ni pour un budget dépassé', () => {
    assert.equal(restesReportables(f, 'jour', mercredi, mardi).length, 0);
    assert.equal(restesReportables(fin([parJour], [dep(25, mardi)]), 'jour', mardi, mardi).length, 0);
  });
});

describe('reporter sur un autre jour', () => {
  const g = reporter(f, deMardi, 8, { case: caseDe('g', 'jour', mercredi) }, 'r1', mardi);
  it('baisse le budget du jour de départ et monte celui d’arrivée', () => {
    assert.equal(bilan(g, 'jour', mardi, mardi).plafondTotal, 12);
    assert.equal(budgetDuJour(g, mercredi), 28);
    assert.equal(prevision(g, 'jour', mercredi)?.plafond, 28);
  });
  it('ne laisse plus rien à reporter : le reste n’est compté qu’une fois', () => {
    assert.equal(restesReportables(g, 'jour', mardi, mardi).length, 0);
    assert.match(erreurReport(g, deMardi, 8, { case: caseDe('g', 'jour', mercredi) }, mardi) ?? '', /rien à reporter/);
  });
  it('ne change pas le budget du mois : l’argent reste dans le mois', () => {
    assert.equal(bilan(g, 'mois', mardi, mardi).plafondTotal, bilan(f, 'mois', mardi, mardi).plafondTotal);
  });
  it('s’annule', () => {
    assert.equal(budgetDuJour(annulerReport(g, 'r1'), mercredi), 20);
  });
  it('se voit sur les deux jours', () => {
    assert.equal(reportsDeLaPeriode(g, mardi, mardi)[0].sens, 'parti');
    assert.equal(reportsDeLaPeriode(g, mercredi, mercredi)[0].sens, 'recu');
  });
});

describe('reporter sur une semaine', () => {
  const g = reporter(f, deMardi, 7, { case: caseDe('g', 'semaine', '2026-11-02') }, 'r2', mardi);
  it('ajoute tout le reste à la semaine et le répartit sur ses jours', () => {
    assert.equal(bilan(g, 'semaine', '2026-11-02', mardi).plafondTotal, 147);
    assert.equal(budgetDuJour(g, '2026-11-03'), 21);
  });
  it('refuse une semaine qui contient le jour de départ', () => {
    assert.match(erreurReport(f, deMardi, 8, { case: caseDe('g', 'semaine', lundi) }, mardi) ?? '', /ne contient pas/);
  });
});

describe('verser le reste sur un objectif', () => {
  const g = reporter(f, deMardi, 8, { objectif: 'o' }, 'r3', mardi);
  it('ajoute un versement à l’objectif', () => {
    const o = g.objectifs![0];
    assert.equal(o.versements[0].report, 'r3');
    assert.equal(suiviObjectif(o, mardi).acquis, 8);
  });
  it('retire le reste des budgets : le mois a 8 € de moins', () => {
    assert.equal(bilan(g, 'mois', mardi, mardi).plafondTotal, bilan(f, 'mois', mardi, mardi).plafondTotal - 8);
  });
  it('rend le reste au budget si le versement est supprimé', () => {
    const sans = { ...g, objectifs: g.objectifs!.map((o) => retirerVersement(o, `rep:r3`)) };
    assert.equal(bilan(sans, 'jour', mardi, mardi).plafondTotal, 20);
  });
  it('ne double pas le versement si le report est rejoué', () => {
    const deux = reporter({ ...g, reports: [] }, deMardi, 8, { objectif: 'o' }, 'r3', mardi);
    assert.equal(deux.objectifs![0].versements.length, 1);
  });
});

describe('budget au mois', () => {
  // Novembre, 300 € : 10 € par jour le 1er (30 jours).
  const mois: Budget = { id: 'c', nom: 'Courses', emoji: '🛒', montant: 300, periode: 'mois' };
  const h = fin([mois]);
  it('un reste versé ailleurs n’est plus réparti sur les jours suivants', () => {
    assert.equal(budgetDuJour(h, '2026-11-02'), 10.34);
    const g = reporter(h, caseDe('c', 'jour', '2026-11-01'), 10, { objectif: 'o' }, 'r4', '2026-11-02');
    assert.equal(budgetDuJour(g, '2026-11-01'), 0);
    assert.equal(budgetDuJour(g, '2026-11-02'), 10);
  });
  it('un reste reçu sur un jour précis compte ce jour-là seulement', () => {
    const g = reporter(h, caseDe('c', 'mois', '2026-10-15'), 15, { case: caseDe('c', 'jour', '2026-11-03') }, 'r5', '2026-11-01');
    assert.equal(budgetDuJour(g, '2026-11-03'), 25.71);
    assert.equal(budgetDuJour(g, '2026-11-02'), 10.34);
  });
});

describe('arrivées proposées', () => {
  it('depuis un jour : le jour, la semaine et le mois qui suivent', () => {
    assert.deepEqual(arriveesProposees(deMardi).map((x) => `${x.case.periode}:${x.case.debut}`), ['jour:2026-10-28', 'semaine:2026-11-02', 'mois:2026-11-01']);
  });
  it('depuis un mois : jamais une semaine à cheval', () => {
    assert.equal(arriveesProposees(caseDe('g', 'mois', mardi)).find((x) => x.case.periode === 'semaine')?.case.debut, '2026-11-02');
  });
});
