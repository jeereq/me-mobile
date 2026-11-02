import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { prononcerNom } from '../src/lib/prononciation.ts';

describe('prononcerNom', () => {
  it('fait dire « mi » au nom de l’app', () => {
    assert.equal(prononcerNom('Me te prévient la veille.'), 'Mi te prévient la veille.');
    assert.equal(prononcerNom('Je suis « Me », ton assistant.'), 'Je suis « Mi », ton assistant.');
    assert.equal(prononcerNom('Bienvenue dans Me !'), 'Bienvenue dans Mi !');
    assert.equal(prononcerNom('Hey Me, ajoute une tâche'), 'Hey Mi, ajoute une tâche');
  });
  it('laisse le pronom tranquille', () => {
    assert.equal(prononcerNom('Il me dit oui.'), 'Il me dit oui.');
    assert.equal(prononcerNom('Me rappeler demain.'), 'Me rappeler demain.');
    assert.equal(prononcerNom('Bonjour. Me voilà de retour.'), 'Bonjour. Me voilà de retour.');
    assert.equal(prononcerNom("M'appeler, Meilleur, Mesure"), "M'appeler, Meilleur, Mesure");
  });
});
