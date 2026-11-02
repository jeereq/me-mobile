import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detecter, erreurMot, lireMotCle, motEffectif, motsProposes, normaliser, variantes } from '../src/lib/mot-cle.ts';

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
    assert.deepEqual(lireMotCle({ actif: true, mot: 'Jarvis' }), { actif: true, mot: 'Jarvis' });
    assert.deepEqual(lireMotCle({ actif: true, mot: 'Hey Alfred', prefixe: 'Hey' }), { actif: true, mot: 'Hey Alfred', prefixe: 'Hey' });
  });
  it('fait suivre le nom de l’app aux anciens mots proposés', () => {
    assert.deepEqual(lireMotCle({ actif: true, mot: ' Salut Me ' }), { actif: true, mot: 'Salut Me', prefixe: 'Salut' });
    assert.deepEqual(lireMotCle({ actif: false, mot: 'Hey Me' }), { actif: false, mot: 'Hey Me', prefixe: 'Hey' });
  });
  it('revient aux valeurs d’origine si le réglage est abîmé', () => {
    assert.deepEqual(lireMotCle(null), { actif: false, mot: 'Hey Me', prefixe: 'Hey' });
    assert.deepEqual(lireMotCle({ actif: 'oui', mot: 'x' }), { actif: false, mot: 'Hey Me', prefixe: 'Hey' });
    assert.deepEqual(lireMotCle('texte'), { actif: false, mot: 'Hey Me', prefixe: 'Hey' });
    assert.deepEqual(lireMotCle({ actif: true, mot: 'Jarvis', prefixe: 'Yo' }), { actif: true, mot: 'Jarvis' });
  });
});

describe('mot-clé et nom de l’app', () => {
  it('propose des mots avec le nom choisi', () => {
    assert.deepEqual(motsProposes('Me').map((m) => m.mot), ['Hey Me', 'Salut Me', 'Ok Me']);
    assert.deepEqual(motsProposes('Jarvis').map((m) => m.mot), ['Hey Jarvis', 'Salut Jarvis', 'Ok Jarvis', 'Jarvis']);
    // Trop court pour être dit seul.
    assert.deepEqual(motsProposes('Max').map((m) => m.mot), ['Hey Max', 'Salut Max', 'Ok Max']);
  });
  it('suit le nom quand le mot vient des propositions, garde un mot tapé tel quel', () => {
    assert.equal(motEffectif({ actif: true, mot: 'Hey Me', prefixe: 'Hey' }, 'Jarvis'), 'Hey Jarvis');
    assert.equal(motEffectif({ actif: true, mot: 'Jarvis', prefixe: '' }, 'Alfred'), 'Alfred');
    assert.equal(motEffectif({ actif: true, mot: 'Jarvis', prefixe: '' }, 'Max'), 'Hey Max');
    assert.equal(motEffectif({ actif: true, mot: 'Abracadabra' }, 'Jarvis'), 'Abracadabra');
    assert.equal(motEffectif({ actif: true, mot: 'Hey Me', prefixe: 'Hey' }), 'Hey Me');
  });
  it('reconnaît le nom choisi même un peu écorché par la dictée', () => {
    assert.equal(detecter('Hé Jarvis, ouvre les finances', 'Hey Jarvis').suite, 'ouvre les finances');
    assert.equal(detecter('hey jarvys ajoute une tâche', 'Hey Jarvis').suite, 'ajoute une tâche');
    assert.equal(detecter('Alfredo, quel temps', 'Alfred').trouve, true);
    assert.equal(detecter('hey jason', 'Hey Jarvis').trouve, false);
    // Les mots courts restent exacts.
    assert.equal(detecter('hey mex', 'Hey Max').trouve, false);
  });
});
