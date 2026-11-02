import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hauteurClavier, placementChamp } from '../src/lib/clavier.ts';

describe('clavier dans le navigateur', () => {
  it('mesure ce que le clavier recouvre', () => {
    assert.equal(hauteurClavier(800, 500, 0), 300);
  });
  it('tient compte de la page poussée vers le haut (iPhone)', () => {
    assert.equal(hauteurClavier(800, 500, 120), 180);
  });
  it('ignore la barre d’adresse qui bouge', () => {
    assert.equal(hauteurClavier(800, 740, 0), 0);
    assert.equal(hauteurClavier(800, 800, 0), 0);
  });
  it('centre un champ d’une ligne, pas un long texte', () => {
    assert.equal(placementChamp('INPUT'), 'center');
    assert.equal(placementChamp('TEXTAREA'), 'nearest');
  });
});
