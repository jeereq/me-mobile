import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { echeanceDe, grouperTaches, habitudesDuJour, limiter, resumeHabitudes, resumeTaches } from '../src/lib/vue-courte.ts';
import type { Habitude, Tache } from '../src/lib/types.ts';

const J = '2026-10-27'; // un mardi
const t = (id: string, x: Partial<Tache> = {}): Tache => ({ id, titre: `Tâche ${id}`, source: 'pro', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'normal', creeLe: '', ...x }) as Tache;
const h = (id: string, x: Partial<Habitude> = {}): Habitude => ({ id, nom: `Habitude ${id}`, categorie: 'perso', frequence: 'quotidien', jour: null, mode: 'normal', coches: [], ordre: 1, ...x }) as Habitude;

describe('limiter', () => {
  const l = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it('coupe après n et dit combien il en reste', () => {
    assert.deepEqual(limiter(l, 4, false), { vues: [1, 2, 3, 4], reste: 6 });
  });
  it('montre tout si on le demande ou si la liste est courte', () => {
    assert.equal(limiter(l, 4, true).vues.length, 10);
    assert.equal(limiter([1, 2], 4, false).reste, 0);
  });
  it('ne cache pas un seul élément derrière « Voir plus »', () => {
    assert.deepEqual(limiter([1, 2, 3, 4, 5], 4, false), { vues: [1, 2, 3, 4, 5], reste: 0 });
  });
});

describe('échéance d’une tâche', () => {
  it('range par rapport à aujourd’hui', () => {
    assert.equal(echeanceDe({ echeance: '2026-10-26' }, J), 'retard');
    assert.equal(echeanceDe({ echeance: J }, J), 'aujourdhui');
    assert.equal(echeanceDe({ echeance: '2026-11-03' }, J), 'semaine');
    assert.equal(echeanceDe({ echeance: '2026-11-04' }, J), 'plus_tard');
    assert.equal(echeanceDe({ echeance: null }, J), 'sans_date');
  });
});

describe('tâches groupées', () => {
  const taches = [
    t('a', { echeance: '2026-10-20' }),
    t('b', { echeance: J, priorite: 'basse' }),
    t('c', { echeance: J, priorite: 'haute' }),
    t('d', { echeance: '2026-12-01' }),
    t('e'),
    t('f', { statut: 'fait', faitLe: '2026-10-25', echeance: '2026-10-20' }),
    t('g', { statut: 'fait', faitLe: J }),
  ];
  const g = grouperTaches(taches, J);
  it('suit l’ordre d’urgence, terminées en dernier, sans groupe vide', () => {
    assert.deepEqual(g.map((x) => x.cle), ['retard', 'aujourdhui', 'plus_tard', 'sans_date', 'terminees']);
  });
  it('trie par priorité dans un groupe', () => {
    assert.deepEqual(g[1].taches.map((x) => x.id), ['c', 'b']);
  });
  it('met les terminées les plus récentes d’abord et ne les compte pas dans les retards', () => {
    assert.deepEqual(g[4].taches.map((x) => x.id), ['g', 'f']);
    assert.deepEqual(g[0].taches.map((x) => x.id), ['a']);
  });
  it('n’ouvre d’emblée que ce qui presse', () => {
    assert.deepEqual(g.map((x) => x.ouvert), [true, true, false, false, false]);
  });
});

describe('résumé des tâches', () => {
  it('compte ce qui presse et l’avancement du jour', () => {
    const r = resumeTaches([t('a', { echeance: '2026-10-20' }), t('b', { echeance: J }), t('c', { echeance: '2026-10-30' }), t('d', { statut: 'fait', faitLe: J }), t('e', { statut: 'fait', faitLe: '2026-10-01' })], J);
    assert.deepEqual(r, { ouvertes: 3, retard: 1, aujourdhui: 1, semaine: 1, faitesAujourdhui: 1, total: 4, pct: 25 });
  });
  it('ne divise pas par zéro', () => {
    assert.equal(resumeTaches([], J).pct, 0);
  });
});

describe('habitudes du jour', () => {
  const hs = [
    h('q', { ordre: 2 }),
    h('lundi', { frequence: 'hebdo', jour: 1, ordre: 1 }),
    h('mardi', { frequence: 'hebdo', jour: 2, ordre: 3 }),
    h('mois', { frequence: 'mensuel', jour: 15, ordre: 4 }),
  ];
  it('sépare ce qui est prévu aujourd’hui du reste', () => {
    const r = habitudesDuJour(hs, J);
    assert.deepEqual(r.aujourdhui.map((x) => x.id), ['q', 'mardi']);
    assert.deepEqual(r.autres.map((x) => x.id), ['lundi', 'mois']);
  });
  it('résume les cochées et les séries', () => {
    const r = resumeHabitudes([h('q', { coches: ['2026-10-25', '2026-10-26', J] }), h('mardi', { frequence: 'hebdo', jour: 2 })], J);
    assert.equal(r.dues, 2);
    assert.equal(r.faites, 1);
    assert.equal(r.pct, 50);
    assert.equal(r.meilleureSerie, 3);
    assert.equal(r.enSerie, 1);
  });
  it('sans habitude, rien à diviser', () => {
    assert.deepEqual(resumeHabitudes([], J), { dues: 0, faites: 0, pct: 0, meilleureSerie: 0, enSerie: 0 });
  });
});
