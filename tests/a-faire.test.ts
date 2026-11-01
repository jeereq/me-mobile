import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lireRelance, lireTache } from '../src/lib/phrase.ts';
import { etatRelance, grouperRelances, quandCourt } from '../src/lib/suivi.ts';
import type { Relance } from '../src/lib/types.ts';

const J = '2026-10-28'; // un mercredi
const r = (x: Partial<Relance> = {}): Relance => ({ id: 'r1', contact: 'Marie', sujet: 'Devis', boite: 'pro', date: J, statut: 'a_faire', mode: 'normal', creeLe: '', ...x });

describe('Ajout en une ligne', () => {
  it('une tâche : la date et l’importance sont comprises, le reste fait le titre', () => {
    assert.deepEqual(lireTache('Rappeler le plombier demain', J), { titre: 'Rappeler le plombier', echeance: '2026-10-29', importante: false });
    assert.deepEqual(lireTache('Envoyer la facture vendredi urgent', J), { titre: 'Envoyer la facture', echeance: '2026-10-30', importante: true });
    assert.deepEqual(lireTache('Payer le loyer !', J), { titre: 'Payer le loyer', echeance: null, importante: true });
    assert.equal(lireTache('   ', J), null);
  });
  it('un « ! » ne rend importante que s’il finit la ligne ou s’il est doublé', () => {
    assert.equal(lireTache('Appeler Paul demain !!', J)?.importante, true);
    assert.equal(lireTache('!! Payer le loyer', J)?.importante, true);
    assert.equal(lireTache('Super ! Appeler Paul demain', J)?.importante, false);
    assert.equal(lireTache('Écrire à Yahoo! Mail', J)?.importante, false);
  });
  it('une relance : le contact, puis le sujet après une virgule ou « pour »', () => {
    assert.deepEqual(lireRelance('Marie, devis du site, dans 3 jours', J), { contact: 'Marie', sujet: 'Devis du site', date: '2026-10-31' });
    assert.deepEqual(lireRelance('Relancer Paul pour le devis jeudi', J), { contact: 'Paul', sujet: 'Le devis', date: '2026-10-29' });
    assert.deepEqual(lireRelance('Cabinet Dupont', J), { contact: 'Cabinet Dupont', sujet: 'Suivi', date: null });
  });
});

describe('Où en est une relance', () => {
  it('dit le jour simplement', () => {
    assert.equal(quandCourt(J, J), "aujourd'hui");
    assert.equal(quandCourt('2026-10-29', J), 'demain');
    assert.equal(quandCourt('2026-10-27', J), 'hier');
    assert.equal(quandCourt('2026-10-31', J), 'samedi');
  });
  it('prévue aujourd’hui, en retard, en attente ou répondue', () => {
    assert.deepEqual(etatRelance(r(), J), { texte: "Prévue aujourd'hui", niveau: 'jour' });
    assert.deepEqual(etatRelance(r({ nbRelances: 2, statut: 'relance', derniereRelance: '2026-10-25' }), J), { texte: "3e relance prévue aujourd'hui", niveau: 'jour' });
    assert.equal(etatRelance(r({ date: '2026-10-26' }), J).niveau, 'retard');
    assert.match(etatRelance(r({ date: '2026-10-26' }), J).texte, /en retard de 2 jours/);
    assert.deepEqual(etatRelance(r({ statut: 'relance', derniereRelance: '2026-10-27', date: '2026-10-30', nbRelances: 1 }), J), { texte: 'Relancé hier · prochaine fois vendredi', niveau: 'attente' });
    assert.equal(etatRelance(r({ statut: 'repondu', reponduLe: '2026-10-27' }), J).niveau, 'fait');
  });
  it('range les relances en trois groupes', () => {
    const g = grouperRelances([r({ id: 'a', date: '2026-11-02' }), r({ id: 'b', date: '2026-10-20' }), r({ id: 'c', statut: 'repondu', reponduLe: J }), r({ id: 'd' })], J);
    assert.deepEqual(g.maintenant.map((x) => x.id), ['b', 'd']);
    assert.deepEqual(g.attente.map((x) => x.id), ['a']);
    assert.deepEqual(g.repondues.map((x) => x.id), ['c']);
  });
});
