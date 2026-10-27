import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { comptesDeMails, filtrerMails, grouperMails, nonLus, titreJourMail, type Mail } from '../src/lib/mails.ts';

const J = '2026-10-27';
const m = (id: string, x: Partial<Mail> = {}): Mail => ({ id, sujet: `Objet ${id}`, contact: 'Marie Dupont', date: J, heure: '10:00', sens: 'recu', source: 'gmail', ctx: 'perso', compte: 'moi@gmail.com', ...x });
const ids = (l: Mail[]) => l.map((x) => x.id);

describe('filtrer les mails', () => {
  const liste = [
    m('a', { ctx: 'perso', nonLu: true }),
    m('b', { ctx: 'pro', compte: 'moi@boite.com', sujet: 'Devis toiture' }),
    m('c', { ctx: 'pro', compte: 'moi@boite.com', contact: 'Paul Martin' }),
  ];
  it('par boîte', () => {
    assert.deepEqual(ids(filtrerMails(liste, { boite: 'pro' })), ['b', 'c']);
    assert.deepEqual(ids(filtrerMails(liste, { boite: 'toutes' })), ['a', 'b', 'c']);
    assert.deepEqual(ids(filtrerMails(liste, {})), ['a', 'b', 'c']);
  });
  it('par compte et par non lus', () => {
    assert.deepEqual(ids(filtrerMails(liste, { compte: 'moi@gmail.com' })), ['a']);
    assert.deepEqual(ids(filtrerMails(liste, { nonLus: true })), ['a']);
  });
  it('par recherche sur l’objet, le contact ou le compte, sans casse', () => {
    assert.deepEqual(ids(filtrerMails(liste, { q: 'DEVIS' })), ['b']);
    assert.deepEqual(ids(filtrerMails(liste, { q: 'paul' })), ['c']);
    assert.deepEqual(ids(filtrerMails(liste, { q: 'boite.com' })), ['b', 'c']);
    assert.deepEqual(ids(filtrerMails(liste, { q: '  ' })), ['a', 'b', 'c']);
  });
  it('combine les filtres', () => {
    assert.deepEqual(ids(filtrerMails(liste, { boite: 'pro', q: 'paul' })), ['c']);
    assert.deepEqual(ids(filtrerMails(liste, { boite: 'perso', nonLus: true, q: 'marie' })), ['a']);
  });
});

describe('comptes et non lus', () => {
  it('liste les comptes avec leur nombre, par ordre alphabétique', () => {
    const r = comptesDeMails([m('a'), m('b', { compte: 'moi@boite.com' }), m('c'), m('d', { compte: undefined })]);
    assert.deepEqual(r, [{ compte: 'moi@boite.com', nombre: 1 }, { compte: 'moi@gmail.com', nombre: 2 }]);
  });
  it('compte les fils non lus', () => {
    assert.equal(nonLus([m('a', { nonLu: true }), m('b'), m('c', { nonLu: true })]), 2);
    assert.equal(nonLus([]), 0);
  });
});

describe('titre d’un jour', () => {
  it('aujourd’hui, hier, sinon la date en toutes lettres', () => {
    assert.equal(titreJourMail(J, J), "Aujourd'hui");
    assert.equal(titreJourMail('2026-10-26', J), 'Hier');
    assert.equal(titreJourMail('2026-10-20', J), 'Mardi 20 octobre');
  });
});

describe('grouper par jour', () => {
  it('du plus récent au plus ancien, heure décroissante dans la journée', () => {
    const g = grouperMails([m('vieux', { date: '2026-10-20', heure: '08:00' }), m('tot', { heure: '07:30' }), m('tard', { heure: '18:00' })], J);
    assert.deepEqual(g.map((x) => x.titre), ["Aujourd'hui", 'Mardi 20 octobre']);
    assert.deepEqual(ids(g[0].mails), ['tard', 'tot']);
  });
  it('met les mails sans date dans leur propre groupe, en dernier', () => {
    const g = grouperMails([m('sans', { date: '' }), m('a')], J);
    assert.deepEqual(g.map((x) => x.cle), [J, 'sans-date']);
    assert.equal(g[1].titre, 'Sans date');
  });
  it('sans mail, aucun groupe', () => {
    assert.deepEqual(grouperMails([], J), []);
  });
});
