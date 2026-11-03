import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { langueTexte, lecteur } from '../src/lib/lecture.ts';

const banc = (morceaux: string[]) => {
  const dits: string[] = [];
  const fins: (() => void)[] = [];
  let fini = 0;
  const l = lecteur(morceaux, (t, fin) => (dits.push(t), fins.push(fin)), () => fini++);
  return { l, dits, fins, finis: () => fini };
};

describe('lecteur', () => {
  it('lit tout dans l’ordre puis termine une seule fois', () => {
    const b = banc(['a', 'b']);
    b.l.lancer();
    b.fins[0]();
    b.fins[1]();
    assert.deepEqual(b.dits, ['a', 'b']);
    assert.equal(b.finis(), 1);
  });
  it('sans rien à lire, termine tout de suite', () => {
    const b = banc([]);
    b.l.lancer();
    assert.equal(b.finis(), 1);
  });
  it('la pause reprend au morceau en cours, sans avancer sur le retour de la coupure', () => {
    const b = banc(['a', 'b', 'c']);
    b.l.lancer();
    b.fins[0]();
    b.l.pause();
    b.fins[1]();
    assert.deepEqual(b.dits, ['a', 'b']);
    b.l.reprendre();
    assert.deepEqual(b.dits, ['a', 'b', 'b']);
    // La fin en retard de la lecture coupée arrive après la reprise : elle ne saute rien.
    b.fins[1]();
    assert.deepEqual(b.dits, ['a', 'b', 'b']);
    b.fins[2]();
    b.fins[3]();
    assert.deepEqual(b.dits, ['a', 'b', 'b', 'c']);
    assert.equal(b.finis(), 1);
  });
  it('une pause avant le départ attend la reprise', () => {
    const b = banc(['a']);
    b.l.pause();
    b.l.lancer();
    assert.deepEqual(b.dits, []);
    b.l.reprendre();
    assert.deepEqual(b.dits, ['a']);
  });
  it('une lecture annulée ne dit plus rien et ne termine pas', () => {
    const b = banc(['a', 'b']);
    b.l.lancer();
    b.l.annuler();
    b.fins[0]();
    b.l.reprendre();
    assert.deepEqual(b.dits, ['a']);
    assert.equal(b.finis(), 0);
  });
});

describe('lecteur : se déplacer', () => {
  it('passe à la phrase suivante, revient en arrière, sans sortir du texte', () => {
    const vus: number[] = [];
    const dits: string[] = [];
    const l = lecteur(['a', 'b', 'c'], (t) => dits.push(t), () => {}, (i) => vus.push(i));
    l.lancer();
    l.aller(1);
    l.aller(1);
    l.aller(1);
    l.aller(-5);
    assert.deepEqual(dits, ['a', 'b', 'c', 'c', 'a']);
    assert.equal(vus.at(-1), 0);
  });
  it('en pause, change de phrase sans parler, et reprend là', () => {
    const dits: string[] = [];
    const l = lecteur(['a', 'b'], (t) => dits.push(t), () => {});
    l.lancer();
    l.pause();
    l.aller(1);
    assert.deepEqual(dits, ['a']);
    l.reprendre();
    assert.deepEqual(dits, ['a', 'b']);
  });
  it('redit la phrase en cours ; une fin en retard ne saute rien', () => {
    const dits: string[] = [];
    const fins: (() => void)[] = [];
    const l = lecteur(['a', 'b'], (t, f) => (dits.push(t), fins.push(f)), () => {});
    l.lancer();
    l.redire();
    fins[0]();
    assert.deepEqual(dits, ['a', 'a']);
  });
});

describe('la langue d’un texte', () => {
  it('reconnaît français, anglais et portugais', () => {
    assert.equal(langueTexte('Bonjour, merci pour votre message, nous vous répondons dans la journée.'), 'fr-FR');
    assert.equal(langueTexte('Hello, thanks for your message, we will answer you and send the file.'), 'en-US');
    assert.equal(langueTexte('Olá, obrigado pela sua mensagem, não temos o ficheiro para você e para os outros.'), 'pt-PT');
  });
  it('le français si rien ne se dégage', () => {
    assert.equal(langueTexte('Ok'), 'fr-FR');
    assert.equal(langueTexte(''), 'fr-FR');
  });
});
