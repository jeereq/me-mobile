import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { destinataires, ongletInitial, parExpediteur, parOnglet, trierAnalyses } from '../src/lib/tri-analyses.ts';

type A = { id: string; action: 'repondre' | 'tache' | 'rien'; urgence: 'haute' | 'normale' | 'basse'; echeance?: string; contact?: string };
const a = (id: string, action: A['action'], urgence: A['urgence'] = 'normale', echeance?: string, contact = ''): A => ({ id, action, urgence, echeance, contact });
const ids = (l: A[]) => l.map((x) => x.id);

describe('tri de l’analyse des mails', () => {
  it('met l’urgent d’abord, puis la date la plus proche, sans changer la liste reçue', () => {
    const l = [a('1', 'repondre', 'basse'), a('2', 'repondre'), a('3', 'repondre', 'normale', '2026-11-20'), a('4', 'repondre', 'normale', '2026-11-05'), a('5', 'repondre', 'haute')];
    assert.deepEqual(ids(trierAnalyses(l)), ['5', '4', '3', '2', '1']);
    assert.equal(l[0].id, '1');
  });
  it('garde l’ordre d’arrivée à égalité', () => {
    assert.deepEqual(ids(trierAnalyses([a('x', 'rien'), a('y', 'rien'), a('z', 'rien')])), ['x', 'y', 'z']);
  });
  it('sépare les réponses, les tâches et le reste', () => {
    const o = parOnglet([a('r', 'repondre'), a('t', 'tache'), a('n', 'rien'), a('r2', 'repondre', 'haute')]);
    assert.deepEqual(ids(o.repondre), ['r2', 'r']);
    assert.deepEqual(ids(o.tache), ['t']);
    assert.deepEqual(ids(o.rien), ['n']);
  });
  it('ouvre le premier onglet qui a du contenu', () => {
    assert.equal(ongletInitial({ repondre: [1], tache: [1], rien: [1] }), 'repondre');
    assert.equal(ongletInitial({ repondre: [], tache: [1], rien: [1] }), 'tache');
    assert.equal(ongletInitial({ repondre: [], tache: [], rien: [1] }), 'rien');
    assert.equal(ongletInitial({ repondre: [], tache: [], rien: [] }), 'repondre');
  });
  it('regroupe par expéditeur, le plus bavard d’abord, sans tenir compte de la casse', () => {
    const g = parExpediteur([a('1', 'rien', 'normale', undefined, 'Ana'), a('2', 'rien', 'normale', undefined, 'vercel[bot]'), a('3', 'rien', 'normale', undefined, 'VERCEL[bot]'), a('4', 'rien', 'normale', undefined, '  ')], (x) => x.contact ?? '');
    assert.deepEqual(g.map((x) => [x.contact, x.analyses.length]), [['vercel[bot]', 2], ['Ana', 1], ['Sans expéditeur', 1]]);
  });
  it('nomme les destinataires d’un envoi, sans doublon', () => {
    assert.equal(destinataires(['Paul']), 'Paul');
    assert.equal(destinataires(['Paul', 'Paul', 'Ana']), 'Paul et Ana');
    assert.equal(destinataires(['Paul', 'Ana', 'Léa']), 'Paul, Ana et 1 autre');
    assert.equal(destinataires(['Paul', 'Ana', 'Léa', 'Max']), 'Paul, Ana et 2 autres');
    assert.equal(destinataires(['']), 'Sans expéditeur');
  });
});
