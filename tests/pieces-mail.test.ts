import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ajouterPieces, avecPieces, MAX_PIECES, MAX_PIECES_OCTETS } from '../src/lib/pieces-mail.ts';

const f = (nom: string, taille?: number) => ({ uri: `file:///${nom}`, nom, type: 'application/pdf', taille });

describe('joindre des fichiers', () => {
  it('ajoute, sans reprendre un fichier déjà là', () => {
    const r = ajouterPieces([f('a.pdf', 10)], [f('a.pdf', 10), f('b.pdf', 20)]);
    assert.deepEqual(r.liste.map((x) => x.nom), ['a.pdf', 'b.pdf']);
    assert.equal(r.refus, null);
  });
  it('garde deux fichiers de même nom et de tailles différentes', () => {
    assert.equal(ajouterPieces([f('a.pdf', 10)], [f('a.pdf', 11)]).liste.length, 2);
  });
  it('s’arrête à la limite du nombre de fichiers', () => {
    const r = ajouterPieces([], Array.from({ length: MAX_PIECES + 2 }, (_, i) => f(`${i}.pdf`, 1)));
    assert.equal(r.liste.length, MAX_PIECES);
    assert.match(r.refus ?? '', /10 pièces/);
  });
  it('s’arrête à la limite de poids, mais garde ce qui tient', () => {
    const r = ajouterPieces([f('a.pdf', MAX_PIECES_OCTETS - 5)], [f('gros.pdf', 10), f('petit.pdf', 5)]);
    assert.deepEqual(r.liste.map((x) => x.nom), ['a.pdf', 'petit.pdf']);
    assert.match(r.refus ?? '', /gros\.pdf/);
  });
  it('refuse un fichier vide, accepte une taille inconnue', () => {
    assert.match(ajouterPieces([], [f('vide.pdf', 0)]).refus ?? '', /vide/);
    assert.equal(ajouterPieces([], [f('inconnu.pdf')]).liste.length, 1);
  });
  it('dit ce qui part', () => {
    assert.equal(avecPieces(0), '');
    assert.equal(avecPieces(1), ' avec 1 pièce jointe');
    assert.equal(avecPieces(3), ' avec 3 pièces jointes');
  });
});
