import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { arbreDossiers, destinations } from '../src/lib/dossiers.ts';
import type { DossierMail } from '../src/lib/sync.ts';

const d = (id: string, genre: DossierMail['genre'] = 'autre', parent?: string): DossierMail => ({ id, nom: id, genre, nonLus: 0, ...(parent ? { parent } : {}) });
const l = [d('rec', 'reception'), d('fac', 'autre', 'rec'), d('2026', 'autre', 'fac'), d('env', 'envoyes'), d('brou', 'brouillons'), d('cli')];

describe('arbre des dossiers', () => {
  it('donne la profondeur et dit qui a des sous-dossiers', () => {
    assert.deepEqual(arbreDossiers(l).map((x) => [x.id, x.profondeur, x.aEnfants]), [
      ['rec', 0, true],
      ['fac', 1, true],
      ['2026', 2, false],
      ['env', 0, false],
      ['brou', 0, false],
      ['cli', 0, false],
    ]);
  });
  it('un dossier replié cache tous ses descendants', () => {
    assert.deepEqual(arbreDossiers(l, new Set(['rec'])).map((x) => x.id), ['rec', 'env', 'brou', 'cli']);
  });
  it('on ne range pas dans les brouillons, les envoyés ni le dossier d’origine', () => {
    assert.deepEqual(destinations(l, 'cli').map((x) => x.id), ['rec', 'fac', '2026']);
  });
  it('sans le dossier d’origine, ses sous-dossiers gardent leur retrait', () => {
    assert.deepEqual(destinations(arbreDossiers(l), 'fac').map((x) => [x.id, x.profondeur]), [['rec', 0], ['2026', 2], ['cli', 0]]);
  });
});
