import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aCompleter } from '../src/lib/a-completer.ts';
import { planifier } from '../src/lib/planning.ts';
import type { Projet, Tache } from '../src/lib/types.ts';

const AUJ = '2026-11-11';
const projet = (id: string): Projet => ({ id, nom: id, emoji: '📁', debut: null, joursOuvres: true, creeLe: AUJ });
let n = 0;
const tache = (p: string, x: Partial<Tache> = {}): Tache => ({ id: `t${++n}`, titre: `T${n}`, source: 'manuel', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'passif', creeLe: AUJ, projet: p, duree: 1, ...x });
const calcul = (liste: [Projet, Tache[]][]) => aCompleter(liste.map(([p, t]) => ({ projet: p, taches: t, plan: planifier(t, p, AUJ) })));

describe('à compléter', () => {
  it('liste ce qui manque à chaque action, les plus incomplètes d\'abord', () => {
    const a = projet('a');
    const b = projet('b');
    const complete = tache('a', { responsable: 'Marie', budget: 0, echeance: '2026-12-01' });
    const sansTout = tache('a');
    const sansBudget = tache('a', { responsable: 'Marie', echeance: '2026-12-01' });
    const autre = tache('b', { responsable: 'DSI' });
    const r = calcul([[a, [complete, sansBudget, sansTout]], [b, [autre]]]);
    assert.deepEqual(r.actions.map((x) => [x.tache.id, x.manques]), [[sansTout.id, ['responsable', 'budget', 'date']], [autre.id, ['budget', 'date']], [sansBudget.id, ['budget']]]);
    assert.deepEqual(r.parManque, { responsable: 1, budget: 3, date: 2 });
    assert.equal(r.nbActions, 4);
  });
  it('un budget à 0 est renseigné ; un début imposé, un lien ou un membre affecté comptent', () => {
    const a = projet('a');
    const t1 = tache('a', { budget: 0, responsable: 'X', fixe: true, debut: '2026-12-01' });
    const t2 = tache('a', { budget: 10, affecteA: 'u1', apres: [t1.id] });
    assert.deepEqual(calcul([[a, [t1, t2]]]).actions, []);
  });
  it('laisse de côté les tâches faites et les résumés', () => {
    const a = projet('a');
    const r = tache('a');
    const r2 = calcul([[a, [r, tache('a', { parent: r.id, responsable: 'X', budget: 1, echeance: '2026-12-01' }), tache('a', { statut: 'fait' })]]]);
    assert.deepEqual([r2.actions.length, r2.nbActions], [0, 1]);
  });
});
