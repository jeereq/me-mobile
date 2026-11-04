import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ajouterEchange, historiqueDe, lireConversation, lireEchanges, marquerAction, MAX_ECHANGES } from '../src/lib/conversation.ts';

const MAILS = new Set(['ext:g1:a']);
const lire = (o: object) => lireConversation(JSON.stringify(o), MAILS);

describe('lire une réponse du copilote', () => {
  it('garde la réponse et les gestes valides', () => {
    const r = lire({
      reponse: ' Relance Paul. ',
      actions: [
        { genre: 'tache', titre: 'Appeler Paul', echeance: '2026-11-05', contact: null, ref: null, brouillon: null },
        { genre: 'relance', titre: 'Devis', contact: 'Paul', echeance: 'demain', ref: null, brouillon: null },
        { genre: 'mail', titre: 'Répondre à Paul', ref: 'ext:g1:a', brouillon: 'Bonjour', echeance: null, contact: null },
      ],
    });
    assert.equal(r.reponse, 'Relance Paul.');
    assert.deepEqual(r.actions.map((a) => a.genre), ['tache', 'relance', 'mail']);
    assert.equal(r.actions[0].echeance, '2026-11-05');
    assert.equal(r.actions[1].echeance, null);
    assert.equal(r.actions[2].brouillon, 'Bonjour');
  });
  it('écarte un mail inconnu, une relance sans personne, un geste sans titre ou d’un autre genre', () => {
    const r = lire({
      reponse: 'x',
      actions: [
        { genre: 'mail', titre: 'Répondre', ref: 'ext:g1:inconnu' },
        { genre: 'mail', titre: 'Répondre' },
        { genre: 'relance', titre: 'Devis', contact: ' ' },
        { genre: 'tache', titre: ' ' },
        { genre: 'supprimer', titre: 'Tout effacer' },
        null,
      ].filter(Boolean),
    });
    assert.deepEqual(r.actions, []);
  });
  it('propose trois gestes au plus', () => {
    assert.equal(lire({ reponse: 'x', actions: Array.from({ length: 6 }, (_, i) => ({ genre: 'tache', titre: `T${i}` })) }).actions.length, 3);
  });
  it('un texte simple reste une réponse, sans geste', () => {
    assert.deepEqual(lireConversation('Tu as 3 tâches.', MAILS), { reponse: 'Tu as 3 tâches.', actions: [] });
    assert.deepEqual(lireConversation('{"autre":1}', MAILS).actions, []);
  });
});

describe('le fil', () => {
  const e = (i: number) => ({ id: `${i}`, question: `Q${i}`, reponse: `R${i}`, actions: [] });
  it('envoie les six derniers échanges, limités', () => {
    const h = historiqueDe(Array.from({ length: 9 }, (_, i) => e(i)));
    assert.equal(h.length, 6);
    assert.deepEqual(h[0], { q: 'Q3', r: 'R3' });
    assert.equal(historiqueDe([{ question: 'x'.repeat(3000), reponse: 'y'.repeat(5000) }])[0].r.length, 4000);
  });
  it('ne garde pas plus que la limite', () => {
    let l = [e(0)];
    for (let i = 1; i < MAX_ECHANGES + 5; i++) l = ajouterEchange(l, e(i));
    assert.equal(l.length, MAX_ECHANGES);
    assert.equal(l.at(-1)?.id, String(MAX_ECHANGES + 4));
  });
  it('relit seulement le fil de ce compte et de cet espace', () => {
    assert.deepEqual(lireEchanges({ pour: 'u1', echanges: [e(1), { id: 'abîmé' }, null] }, 'u1'), [e(1)]);
    assert.deepEqual(lireEchanges({ pour: 'u2', echanges: [e(1)] }, 'u1'), []);
    assert.deepEqual(lireEchanges(null, 'u1'), []);
    assert.deepEqual(lireEchanges({ pour: 'u1', echanges: 'x' }, 'u1'), []);
  });
  it('note et oublie ce qu’un geste a créé', () => {
    const l = [{ ...e(1), actions: [{ id: '0', genre: 'tache' as const, titre: 'T', echeance: null }] }];
    const m = marquerAction(l, '1', '0', 'tache1');
    assert.equal(m[0].actions[0].cree, 'tache1');
    assert.equal('cree' in marquerAction(m, '1', '0')[0].actions[0], false);
    assert.equal(marquerAction(l, 'autre', '0', 'x')[0].actions[0].cree, undefined);
  });
});
