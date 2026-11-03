import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { choisirVoixEve } from '../src/lib/voix-eve.ts';

const v = (identifier: string, name: string, language = 'fr-FR', quality = 'Default') => ({ identifier, name, language, quality });

describe('Eve : la voix de l’appareil', () => {
  it('préfère une voix française féminine', () => {
    assert.equal(choisirVoixEve([v('t', 'Thomas'), v('a', 'Audrey')]), 'a');
    assert.equal(choisirVoixEve([v('m', 'Microsoft Paul'), v('d', 'Microsoft Denise - French (France)')]), 'd');
    assert.equal(choisirVoixEve([v('fr-fr-x-frb-local', 'fr-fr-x-frb-local'), v('fr-fr-x-vlf-local', 'fr-fr-x-vlf-local')]), 'fr-fr-x-vlf-local');
  });
  it('préfère la meilleure qualité, puis le français de France', () => {
    assert.equal(choisirVoixEve([v('a', 'Audrey'), v('b', 'Audrey', 'fr-FR', 'Enhanced')]), 'b');
    assert.equal(choisirVoixEve([v('c', 'Amélie', 'fr-CA'), v('a', 'Audrey')]), 'a');
  });
  it('ignore les autres langues', () => {
    assert.equal(choisirVoixEve([v('s', 'Samantha', 'en-US')]), undefined);
    assert.equal(choisirVoixEve([]), undefined);
  });
  it('prend une voix française inconnue plutôt que rien', () => {
    assert.equal(choisirVoixEve([v('x', 'Inconnue')]), 'x');
  });
});
