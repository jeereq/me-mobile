import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lireApparence, themeAffiche } from '../src/lib/apparence-regles.ts';

const T = { jarvis: 1, mark: 1, matrice: 1, clair: 1 };

describe('thème de l’appareil', () => {
  it('passe avant l’ancien choix de l’espace, puis avant la configuration', () => {
    const config = { nom: 'clair', accent: '' };
    assert.deepEqual(themeAffiche({ theme: 'mark', accent: '#fff' }, { theme: 'matrice' }, config, T), { nom: 'mark', accent: '#fff', propre: true });
    assert.deepEqual(themeAffiche(null, { theme: 'matrice' }, config, T), { nom: 'matrice', accent: '', propre: true });
    assert.deepEqual(themeAffiche(null, undefined, config, T), { nom: 'clair', accent: '', propre: false });
    assert.equal(themeAffiche(null, undefined, { nom: 'inconnu' }, T).nom, 'jarvis');
  });
  it('ignore une valeur abîmée ou un thème disparu', () => {
    assert.equal(lireApparence('{pas du json', T), null);
    assert.equal(lireApparence('{"theme":"ancien"}', T), null);
    assert.deepEqual(lireApparence('{"theme":"clair"}', T), { theme: 'clair', accent: '' });
  });
});
