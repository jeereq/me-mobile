import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilan } from '../src/lib/finances.ts';
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
    assert.equal(prevision(g, 'jour', mercredi)?.plafond, 28);
  });
  it('ne laisse plus rien à reporter : le reste n’est compté qu’une fois', () => {
    assert.equal(restesReportables(g, 'jour', mardi, mardi).length, 0);
    assert.match(erreurReport(g, deMardi, 8, { case: caseDe('g', 'jour', mercredi) }, mardi) ?? '', /rien à reporter/);
  });
  it('un budget par jour vu sur le mois garde sa journée', () => {
    assert.equal(bilan(g, 'mois', mercredi, mercredi).plafondTotal, 28);
  });
  it('s’annule', () => {
    assert.equal(prevision(annulerReport(g, 'r1'), 'jour', mercredi)?.plafond, 20);
  });
  it('se voit sur les deux jours', () => {
    assert.equal(reportsDeLaPeriode(g, mardi, mardi)[0].sens, 'parti');
    assert.equal(reportsDeLaPeriode(g, mercredi, mercredi)[0].sens, 'recu');
  });
});

describe('reporter sur une semaine', () => {
  const g = reporter(f, deMardi, 7, { case: caseDe('g', 'semaine', '2026-11-02') }, 'r2', mardi);
  it('répartit le reste sur les jours d’un budget par jour', () => {
    assert.equal(prevision(g, 'jour', '2026-11-03')?.plafond, 21);
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
  const mois: Budget = { id: 'c', nom: 'Courses', emoji: '🛒', montant: 300, periode: 'mois' };
  // Octobre : 260 € notés sur 300, il reste 40 €.
  const h = fin([mois], [dep(260, '2026-10-10', 'c')]);
  it('propose le reste de son mois, même vu sur une journée', () => {
    const r = restesReportables(h, 'jour', mardi, mardi);
    assert.deepEqual(r.map((x) => [x.reste, x.case.periode, x.case.debut]), [[40, 'mois', '2026-10-01']]);
  });
  it('reporte le reste d’octobre sur novembre', () => {
    const g = reporter(h, restesReportables(h, 'mois', mardi, mardi)[0].case, 40, { case: caseDe('c', 'mois', '2026-11-01') }, 'r4', mardi);
    assert.equal(bilan(g, 'mois', mardi, mardi).lignes[0].reste, 0);
    assert.equal(bilan(g, 'mois', '2026-11-05', '2026-11-05').lignes[0].plafond, 340);
    assert.equal(restesReportables(g, 'mois', mardi, mardi).length, 0);
  });
  it('un reste reçu sur un jour précis compte dans le mois de ce jour', () => {
    const g = reporter(h, caseDe('c', 'mois', '2026-10-15'), 15, { case: caseDe('c', 'jour', '2026-11-03') }, 'r5', '2026-11-01');
    assert.equal(bilan(g, 'mois', '2026-11-03', '2026-11-03').lignes[0].plafond, 315);
    assert.equal(bilan(g, 'mois', '2026-10-15', '2026-11-03').lignes[0].plafond, 285);
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
