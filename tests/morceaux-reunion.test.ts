import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assembler, manquants, type Morceau } from '../src/lib/morceaux-reunion.ts';

const m = (n: number, x: Partial<Morceau> = {}): Morceau => ({ n, uri: `f${n}`, dureeMs: 1_200_000, ...x });

describe('morceaux d\'une longue réunion', () => {
  it('recolle les textes dans l\'ordre des morceaux', () => {
    assert.equal(assembler([m(2, { texte: ' suite ' }), m(1, { texte: 'début' }), m(3, { texte: 'fin' })]), 'début\n\nsuite\n\nfin');
  });
  it('laisse de côté les morceaux sans texte', () => {
    const liste = [m(1, { texte: 'début' }), m(2, { erreur: 'Serveur injoignable.' }), m(3, { texte: 'fin' })];
    assert.equal(assembler(liste), 'début\n\nfin');
    assert.deepEqual(manquants(liste).map((x) => x.n), [2]);
  });
  it('rien ne manque quand tout est transcrit', () => {
    assert.equal(manquants([m(1, { texte: 'a' }), m(2, { texte: '' })]).length, 0);
    assert.equal(assembler([]), '');
  });
});
