import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detecter, erreurMot, lireMotCle, normaliser, variantes } from '../src/lib/mot-cle.ts';

describe('normaliser', () => {
  it('enlève accents, ponctuation et majuscules', () => {
    assert.equal(normaliser('  Hé, Me !  '), 'he me');
    assert.equal(normaliser("Ajoute-moi l'été"), 'ajoute moi l ete');
  });
});

describe('mot-clé valide', () => {
  it('refuse un mot trop court ou trop long', () => {
    assert.ok(erreurMot('me'));
    assert.ok(erreurMot('a b'));
    assert.ok(erreurMot('un deux trois quatre'));
    assert.ok(erreurMot('x'.repeat(31)));
  });
  it('accepte une expression raisonnable', () => {
    assert.equal(erreurMot('Hey Me'), null);
    assert.equal(erreurMot('Jarvis'), null);
  });
});

describe('variantes', () => {
  it('couvre les écritures de « Hey Me »', () => {
    const v = variantes('Hey Me').map((x) => x.join(' '));
    for (const x of ['hey me', 'he mi', 'ey me', 'hey mie']) assert.ok(v.includes(x), x);
  });
  it('garde un mot libre tel quel', () => {
    assert.deepEqual(variantes('Jarvis'), [['jarvis']]);
  });
});

describe('détection du mot-clé', () => {
  it('trouve le mot seul', () => {
    assert.deepEqual(detecter('Hey Me', 'Hey Me'), { trouve: true, suite: '' });
  });
  it('rend ce qui suit, avec son orthographe', () => {
    const r = detecter('hey me, ajoute une dépense de 12 € de courses', 'Hey Me');
    assert.equal(r.trouve, true);
    assert.equal(r.suite, 'ajoute une dépense de 12 € de courses');
  });
  it('accepte une écriture proche de la dictée', () => {
    assert.equal(detecter('Hé mi, ouvre les finances', 'Hey Me').suite, 'ouvre les finances');
    assert.equal(detecter('Ey me', 'Hey Me').trouve, true);
  });
  it('trouve le mot au milieu de la phrase', () => {
    const r = detecter('bon alors hey me combien il me reste', 'Hey Me');
    assert.equal(r.trouve, true);
    assert.equal(r.suite, 'combien il me reste');
  });
  it('ne se déclenche pas sur des mots qui contiennent le mot-clé', () => {
    assert.equal(detecter('they measure it', 'Hey Me').trouve, false);
    assert.equal(detecter('il me dit hey', 'Hey Me').trouve, false);
    assert.equal(detecter('', 'Hey Me').trouve, false);
  });
  it('marche avec un mot personnel, sans tenir compte des accents', () => {
    assert.equal(detecter('Jarvis, Planifie ma journée', 'jarvis').suite, 'Planifie ma journée');
    assert.equal(detecter('Éléphant, ouvre les tâches', 'elephant').suite, 'ouvre les tâches');
  });
  it('ne trouve rien sans mot-clé valide', () => {
    assert.equal(detecter('hey me', '').trouve, false);
  });
});

describe('réglage enregistré', () => {
  it('relit un réglage correct', () => {
    assert.deepEqual(lireMotCle({ actif: true, mot: ' Salut Me ' }), { actif: true, mot: 'Salut Me' });
  });
  it('revient aux valeurs d’origine si le réglage est abîmé', () => {
    assert.deepEqual(lireMotCle(null), { actif: false, mot: 'Hey Me' });
    assert.deepEqual(lireMotCle({ actif: 'oui', mot: 'x' }), { actif: false, mot: 'Hey Me' });
    assert.deepEqual(lireMotCle('texte'), { actif: false, mot: 'Hey Me' });
  });
});
