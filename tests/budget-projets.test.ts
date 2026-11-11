import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { budgetProjet, fmtSomme, lireSaisie, sommeBudgets } from '../src/lib/budget-projets.ts';
import { feuilleDeRoute } from '../src/lib/feuille-de-route.ts';
import { planifier, tachesDuProjet } from '../src/lib/planning.ts';
import type { Projet, Tache } from '../src/lib/types.ts';

const AUJ = '2026-11-11';
const projet: Projet = { id: 'p', nom: 'P', emoji: '📁', debut: null, joursOuvres: true, creeLe: AUJ };
let n = 0;
const tache = (fin: string, x: Partial<Tache> = {}): Tache => ({ id: `t${++n}`, titre: `T${n}`, source: 'manuel', priorite: 'moyenne', echeance: fin, statut: 'en_attente', mode: 'passif', creeLe: AUJ, projet: 'p', debut: fin, duree: 1, fixe: true, ...x });
const calcul = (ts: Tache[]) => budgetProjet(tachesDuProjet(ts, 'p'), planifier(tachesDuProjet(ts, 'p'), projet, AUJ));

describe('budget des projets', () => {
  it('additionne prévu et engagé, et compte ce qui n\'a pas de budget', () => {
    const b = calcul([tache('2026-12-01', { budget: 500, engage: 100 }), tache('2027-01-10', { budget: 250.5 }), tache('2027-02-10'), tache('2027-02-11', { statut: 'fait' })]);
    assert.deepEqual(b, { prevu: 750.5, engage: 100, reste: 650.5, depasse: false, sansBudget: 1, renseigne: true });
  });
  it('ne compte pas deux fois un résumé et ses sous-tâches', () => {
    const r = tache('2027-01-01', { budget: 9999, id: 'r' });
    const b = calcul([r, tache('2027-01-01', { parent: 'r', budget: 300 }), tache('2027-01-02', { parent: 'r', budget: 200 })]);
    assert.equal(b.prevu, 500);
  });
  it('signale un dépassement ; rien de saisi : non renseigné', () => {
    assert.equal(calcul([tache('2026-12-01', { budget: 100, engage: 150 })]).depasse, true);
    assert.deepEqual([calcul([tache('2026-12-01')]).renseigne, calcul([]).prevu], [false, 0]);
  });
  it('somme de plusieurs projets', () => {
    const a = calcul([tache('2026-12-01', { budget: 100, engage: 200 })]);
    const b = calcul([tache('2026-12-01', { budget: 50 })]);
    assert.deepEqual(sommeBudgets([a, b]), { prevu: 150, engage: 200, reste: -50, depasse: true, sansBudget: 0, renseigne: true });
  });
  it('budget par trimestre dans la feuille de route', () => {
    const ts = [tache('2026-12-10', { budget: 400 }), tache('2026-12-20', { budget: 100 }), tache('2027-02-01', { budget: 70 })];
    const f = feuilleDeRoute([{ projet, taches: ts, plan: planifier(ts, projet, AUJ) }], AUJ);
    assert.deepEqual(f.colonnes.map((c) => c.prevu), [500, 70]);
    assert.equal(f.lignes[0].cases['2026-T4'].prevu, 500);
  });
  it('formate et lit les montants', () => {
    assert.equal(fmtSomme(8500), '8 500 $');
    assert.equal(fmtSomme(1250.4, '€'), '1 250 €');
    assert.deepEqual(['8 500', '1250,50', '', 'abc', '-3'].map(lireSaisie), [8500, 1250.5, null, null, null]);
  });
});
