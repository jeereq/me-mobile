import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { feuilleDeRoute, nomTrimestre, PLUS_TARD, tachesDe, trimestreDe, trimestreSuivant } from '../src/lib/feuille-de-route.ts';
import { planifier, tachesDuProjet } from '../src/lib/planning.ts';
import type { Projet, Tache } from '../src/lib/types.ts';

const AUJ = '2026-11-11';
const projet = (id: string): Projet => ({ id, nom: id, emoji: '📁', debut: null, joursOuvres: true, creeLe: AUJ });
let n = 0;
const tache = (p: string, fin: string, x: Partial<Tache> = {}): Tache => ({ id: `t${++n}`, titre: `T${n}`, source: 'manuel', priorite: 'moyenne', echeance: fin, statut: 'en_attente', mode: 'passif', creeLe: AUJ, projet: p, debut: fin, duree: 1, fixe: true, ...x });
const route = (projets: Projet[], taches: Tache[]) => feuilleDeRoute(projets.map((p) => ({ projet: p, taches: tachesDuProjet(taches, p.id), plan: planifier(tachesDuProjet(taches, p.id), p, AUJ) })), AUJ);

describe('feuille de route', () => {
  it('trimestres', () => {
    assert.equal(trimestreDe('2026-11-11'), '2026-T4');
    assert.equal(trimestreDe('2027-01-01'), '2027-T1');
    assert.equal(trimestreDe('2027-06-30'), '2027-T2');
    assert.equal(trimestreSuivant('2026-T4'), '2027-T1');
    assert.equal(trimestreSuivant('2027-T2'), '2027-T3');
    assert.equal(nomTrimestre('2026-T4'), 'T4 2026');
  });
  it('range chaque tâche dans le trimestre de sa fin, projet par projet', () => {
    const a = projet('a');
    const b = projet('b');
    const f = route([a, b], [tache('a', '2026-12-15', { priorite: 'haute' }), tache('a', '2027-02-10'), tache('a', '2027-02-11', { statut: 'fait' }), tache('b', '2027-08-03')]);
    assert.deepEqual(f.colonnes.map((c) => c.cle), ['2026-T4', '2027-T1', '2027-T2', '2027-T3']);
    assert.deepEqual(f.colonnes.map((c) => c.restantes), [1, 1, 0, 1]);
    assert.equal(f.colonnes[0].courant, true);
    assert.deepEqual([f.lignes[0].cases['2026-T4'].hautes, f.lignes[0].cases['2027-T1'].total, f.lignes[0].cases['2027-T1'].faites], [1, 2, 1]);
    assert.equal(f.lignes[1].cases['2026-T4'], undefined);
    assert.equal(tachesDe(f, '2027-T1').length, 2);
    assert.equal(tachesDe(f, '2027-T1', 'b').length, 0);
    assert.equal(f.max, 1);
  });
  it('garde les retards dans leur trimestre et oublie ce qui est fini avant', () => {
    const a = projet('a');
    const f = route([a], [tache('a', '2026-03-10', { statut: 'fait' }), tache('a', '2026-08-20'), tache('a', '2026-12-01')]);
    assert.deepEqual(f.colonnes.map((c) => c.cle), ['2026-T3', '2026-T4']);
    assert.deepEqual([f.colonnes[0].passe, f.colonnes[0].enRetard, f.colonnes[1].enRetard], [true, 1, 0]);
    assert.deepEqual([f.lignes[0].total, f.lignes[0].faites], [3, 1]);
  });
  it('signale le trimestre nettement plus chargé, et range le lointain dans « Plus tard »', () => {
    const a = projet('a');
    const taches = [...Array.from({ length: 13 }, () => tache('a', '2026-12-10')), tache('a', '2027-02-01'), tache('a', '2027-05-01'), tache('a', '2033-01-01')];
    const f = route([a], taches);
    assert.deepEqual(f.colonnes.filter((c) => c.charge).map((c) => c.nom), ['T4 2026']);
    assert.equal(f.colonnes.length, 13);
    assert.equal(f.colonnes[12].cle, PLUS_TARD);
    assert.equal(f.colonnes[12].restantes, 1);
    assert.equal(f.max, 13);
  });
  it('sans tâche : aucune colonne', () => {
    assert.deepEqual(route([projet('a')], []).colonnes, []);
  });
});
