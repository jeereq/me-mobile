import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aLaSuite, assembleur, choisirAlternative } from '../src/lib/dictee.ts';
import { couperTexte, paquetsTexte, traduire } from '../src/lib/traduction.ts';

describe('la dictée', () => {
  it('une pause ne perd pas le début de la phrase', () => {
    const a = assembleur();
    assert.equal(a.recevoir('ajoute une', false), 'ajoute une');
    assert.equal(a.recevoir('ajoute une dépense', true), 'ajoute une dépense');
    assert.equal(a.recevoir('de 12', false), 'ajoute une dépense de 12');
    assert.equal(a.recevoir('de 12 euros', true), 'ajoute une dépense de 12 euros');
  });
  it('propose les autres façons de comprendre le segment', () => {
    const a = assembleur();
    a.recevoir('relance', true);
    a.recevoir('pool', true);
    assert.deepEqual(a.variantes(['pool', 'Paul'], true), ['relance pool', 'relance Paul']);
  });
  it('garde la première commande comprise, sinon ce qui a été entendu', () => {
    const comprise = (t: string) => t.includes('Paul');
    assert.equal(choisirAlternative(['relance pool', 'relance Paul'], comprise), 'relance Paul');
    assert.equal(choisirAlternative([' bonjour ', 'bon jour'], comprise), 'bonjour');
    assert.equal(choisirAlternative(['', ' '], comprise), '');
  });
  it('écrit la dictée à la suite du brouillon', () => {
    assert.equal(aLaSuite('', 'Bonjour'), 'Bonjour');
    assert.equal(aLaSuite('Bonjour ', 'Paul'), 'Bonjour Paul');
    assert.equal(aLaSuite('Bonjour,\n', 'merci'), 'Bonjour,\nmerci');
    assert.equal(aLaSuite('Bonjour', ''), 'Bonjour');
  });
});

describe('la traduction', () => {
  it('coupe un long texte aux paragraphes, sans rien perdre', () => {
    const t = `${'a'.repeat(60)}\n\n${'b'.repeat(60)}\n\n${'c'.repeat(60)}`;
    const m = couperTexte(t, 100);
    assert.ok(m.every((x) => x.length <= 100));
    assert.equal(m.join('\n\n'), t);
    assert.equal(couperTexte('court', 100)[0], 'court');
    assert.ok(couperTexte('x'.repeat(250), 100).every((x) => x.length <= 100));
  });
  it('fait des paquets sous la limite', () => {
    assert.deepEqual(paquetsTexte(['aa', 'bb', 'cc'], 4), [['aa', 'bb'], ['cc']]);
    assert.deepEqual(paquetsTexte([], 4), []);
  });
  it('garde l’ordre, laisse le vide et ne redemande pas', async () => {
    const lots: string[][] = [];
    const dem = async (l: string[]) => (lots.push(l), l.map((x) => x.toUpperCase()));
    assert.deepEqual(await traduire(['un', '', 'deux', 'un'], 'en', dem), ['UN', '', 'DEUX', 'UN']);
    assert.deepEqual(lots, [['un', 'deux']]);
    assert.deepEqual(await traduire(['un'], 'en', dem), ['UN']);
    assert.equal(lots.length, 1);
    await traduire(['un'], 'pt', dem);
    assert.equal(lots.length, 2);
  });
  it('recompose un long texte', async () => {
    const t = `${'a '.repeat(8000)}\n\n${'b '.repeat(8000)}`;
    const [r] = await traduire([t], 'fr', async (l) => l);
    assert.equal(r.replace(/\s+/g, ''), t.replace(/\s+/g, ''));
  });
});
