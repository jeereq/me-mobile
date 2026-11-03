import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { depuisQuand, lireReprise, lotsParCompte, resteATraiter } from '../src/lib/reprise-analyse.ts';

const NOW = Date.parse('2026-11-03T12:00:00Z');
const a = (id: string, action: 'repondre' | 'tache' | 'rien') => ({ id, action, resume: '', urgence: 'normale' as const, reponse: '', tache: '' });
const base = { pour: 'u1', quand: '2026-11-03T10:00:00Z', mails: [{ id: 'x' }], suivant: 1, analyses: [a('x', 'rien')], consignes: '' };

describe('reprendre une analyse', () => {
  it('compte ce qui reste, sans ce qui est traité', () => {
    const r = { mails: Array.from({ length: 4 }, (_, i) => ({ id: `${i}` })) as never[], suivant: 1, analyses: [a('r1', 'repondre'), a('r2', 'repondre'), a('t1', 'tache'), a('s1', 'rien')], envoyes: ['r1'], taches: ['t1'], ranges: { s1: 'lu' as const } };
    assert.equal(resteATraiter(r), 1);
  });
  it('compte aussi les mails pas encore analysés', () => {
    const mails = Array.from({ length: 25 }, (_, i) => ({ id: `${i}` })) as never[];
    assert.equal(resteATraiter({ mails, suivant: 1, analyses: [], envoyes: [], taches: [], ranges: {} }), 15);
  });
  it('refuse une reprise abîmée, vide, future ou trop ancienne', () => {
    assert.equal(lireReprise(null, NOW), null);
    assert.equal(lireReprise('x', NOW), null);
    assert.equal(lireReprise({ ...base, analyses: [] }, NOW), null);
    assert.equal(lireReprise({ ...base, quand: '2026-10-20T10:00:00Z' }, NOW), null);
    assert.equal(lireReprise({ ...base, quand: '2026-11-05T10:00:00Z' }, NOW), null);
  });
  it('complète ce qui manque', () => {
    const r = lireReprise(base, NOW)!;
    assert.deepEqual([r.textes, r.decoches, r.envoyes, r.taches, r.ranges, r.introuvables], [{}, [], [], [], {}, 0]);
  });
  it('dit depuis quand', () => {
    assert.equal(depuisQuand('2026-11-03T11:59:50Z', NOW), 'à l’instant');
    assert.equal(depuisQuand('2026-11-03T11:30:00Z', NOW), 'il y a 30 min');
    assert.equal(depuisQuand('2026-11-03T09:00:00Z', NOW), 'il y a 3 h');
    assert.equal(depuisQuand('2026-11-02T09:00:00Z', NOW), 'hier');
    assert.equal(depuisQuand('2026-10-30T09:00:00Z', NOW), 'il y a 4 jours');
  });
  it('range les mails par compte et par lots', () => {
    const refs = [...Array.from({ length: 3 }, (_, i) => ({ compte: 'a', element: `${i}` })), { compte: 'b', element: 'z' }];
    assert.deepEqual(lotsParCompte(refs, 2), [{ compte: 'a', elements: ['0', '1'] }, { compte: 'a', elements: ['2'] }, { compte: 'b', elements: ['z'] }]);
  });
});
