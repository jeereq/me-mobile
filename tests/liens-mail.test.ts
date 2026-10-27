import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cleFil, delier, ecarter, liesAuMail, lier, mailDuLien, mailSuggere, memeContact, objetNu, objetPropre, refLien, relanceDepuisMail, suggestionsPourMail, tacheDepuisMail } from '../src/lib/liens-mail.ts';
import type { Mail } from '../src/lib/mails.ts';
import { fusionner, type Synchro } from '../src/lib/sync.ts';
import type { Config, Espace, Relance, Tache } from '../src/lib/types.ts';

const J = '2026-10-27';
const m = (id: string, x: Partial<Mail> = {}): Mail => ({ id: `ext:g1:${id}`, fil: `f-${id}`, sujet: 'Devis toiture', contact: 'Paul Martin', adresse: 'Paul Martin <paul@martin.fr>', date: J, heure: '10:00', sens: 'recu', source: 'gmail', ctx: 'pro', lien: `https://mail/${id}`, ...x });
const rel = (id: string, x: Partial<Relance> = {}): Relance => ({ id, contact: 'Paul', sujet: 'Devis toiture', boite: 'pro', date: J, statut: 'a_faire', mode: 'normal', creeLe: J, ...x });
const tac = (id: string, x: Partial<Tache> = {}): Tache => ({ id, titre: 'Signer le devis', source: 'pro', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'normal', creeLe: J, ...x });
const esp = (o: Partial<Espace> = {}) => ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], majLe: J, ...o }) as Espace;
const config = { delaiRelanceJours: 3, defauts: { relance: 'normal', tache: 'coach', facture: 'normal', finance: 'normal', perso: 'normal' } } as unknown as Config;

describe('clé de fil', () => {
  it('compte connecté puis fil, sinon le message', () => {
    assert.equal(cleFil(m('a')), 'g1:f-a');
    assert.equal(cleFil(m('a', { fil: undefined })), 'g1:a');
  });
  it('deux messages du même fil donnent la même clé', () => {
    assert.equal(cleFil(m('a', { fil: 'X' })), cleFil(m('b', { fil: 'X' })));
  });
});

describe('objet et contact', () => {
  it('retire Re, TR, Fwd', () => {
    assert.equal(objetNu('RE: TR : Fwd: Devis Toiture'), 'devis toiture');
    assert.equal(objetPropre('Re: Devis toiture'), 'Devis toiture');
  });
  it('reconnaît un contact par son prénom ou son adresse', () => {
    assert.equal(memeContact('Paul', m('a')), true);
    assert.equal(memeContact('paul martin', m('a')), true);
    assert.equal(memeContact('paul@martin.fr', m('a')), true);
    assert.equal(memeContact('Marie', m('a')), false);
  });
});

describe('suggestions', () => {
  it('propose la relance au même contact et au même objet, puis celle au même objet', () => {
    const e = esp({ relances: [rel('r1'), rel('r2', { contact: 'Marie', sujet: 'Re: devis toiture' }), rel('r3', { contact: 'Paul', sujet: 'Facture de mars' })] });
    const s = suggestionsPourMail(m('a'), e);
    assert.deepEqual(s.map((x) => [x.id, x.raison]), [['r1', 'Même contact et même objet'], ['r2', 'Même objet']]);
  });
  it('propose une tâche qui cite le contact et un mot de l’objet', () => {
    const s = suggestionsPourMail(m('a'), esp({ taches: [tac('t1', { titre: 'Envoyer le devis à Paul' }), tac('t2', { titre: 'Acheter du pain' })] }));
    assert.deepEqual(s.map((x) => x.id), ['t1']);
  });
  it('ignore ce qui est déjà lié, fait, écarté ou dans un projet', () => {
    const e = esp({
      relances: [rel('r1', { statut: 'repondu' }), rel('r2', { mail: { fil: 'g1:autre', sujet: 'x' } }), rel('r3', { mailsEcartes: ['g1:f-a'] })],
      taches: [tac('t1', { titre: 'Devis toiture', projet: 'p' }), tac('t2', { titre: 'Devis toiture', statut: 'fait' })],
    });
    assert.deepEqual(suggestionsPourMail(m('a'), e), []);
  });
  it('trouve le mail le plus récent pour une relance', () => {
    const mails = [m('vieux', { date: '2026-10-20' }), m('neuf'), m('autre', { sujet: 'Rien à voir', contact: 'Zoé', adresse: 'zoe@x.fr' })];
    assert.equal(mailSuggere({ genre: 'relance', r: rel('r1') }, mails)?.mail.id, 'ext:g1:neuf');
    assert.equal(mailSuggere({ genre: 'relance', r: rel('r1', { mailsEcartes: ['g1:f-neuf'] }) }, mails)?.mail.id, 'ext:g1:vieux');
    assert.equal(mailSuggere({ genre: 'relance', r: rel('r1', { contact: 'Zoé', sujet: 'Vacances' }) }, mails), null);
  });
});

describe('lier, délier, écarter', () => {
  it('lie, retrouve le mail et le liste', () => {
    const e = lier(esp({ relances: [rel('r1', { mailsEcartes: ['g1:f-a'] })] }), 'relance', 'r1', m('a'));
    const r = e.relances[0];
    assert.equal(r.mail?.fil, 'g1:f-a');
    assert.equal(r.mail?.adresse, 'paul@martin.fr');
    assert.equal(r.mailsEcartes, undefined);
    assert.equal(mailDuLien(r.mail, [m('b'), m('a')])?.id, 'ext:g1:a');
    assert.deepEqual(liesAuMail(m('a'), e).map((x) => x.id), ['r1']);
  });
  it('délier retient le fil pour ne plus le proposer', () => {
    const e = delier(lier(esp({ taches: [tac('t1')] }), 'tache', 't1', m('a')), 'tache', 't1');
    assert.equal(e.taches[0].mail, undefined);
    assert.deepEqual(e.taches[0].mailsEcartes, ['g1:f-a']);
  });
  it('écarter une suggestion', () => {
    assert.deepEqual(ecarter(esp({ relances: [rel('r1')] }), 'relance', 'r1', m('a')).relances[0].mailsEcartes, ['g1:f-a']);
  });
});

describe('créer depuis un mail', () => {
  it('une relance dans le délai habituel, liée au mail', () => {
    const r = relanceDepuisMail(m('a', { sujet: 'Re: Devis toiture' }), config, J);
    assert.deepEqual([r.contact, r.sujet, r.boite, r.date, r.mail?.fil], ['Paul Martin', 'Devis toiture', 'pro', '2026-10-30', 'g1:f-a']);
  });
  it('une tâche à l’objet du mail', () => {
    const t = tacheDepuisMail(m('a'), config);
    assert.deepEqual([t.titre, t.source, t.mode, t.mail?.fil], ['Devis toiture', 'pro', 'coach', 'g1:f-a']);
  });
});

describe('synchro : les éléments importés d’un mail y sont rattachés', () => {
  const s: Synchro = {
    integrations: [],
    agenda: [],
    taches: [{ id: 'ext:g1:msg1', source: 'gmail', ctx: 'pro', titre: 'Devis · Paul', echeance: null, lien: 'https://mail/f1', mail: { fil: 'f1', sujet: 'Devis', contact: 'Paul', adresse: 'Paul <paul@martin.fr>' } }],
    relances: [{ id: 'ext:g1:f2', source: 'gmail', ctx: 'pro', contact: 'Marie', sujet: 'Contrat', date: J, mail: { fil: 'f2', sujet: 'Contrat' } }],
  };
  it('nouveaux éléments', () => {
    const e = fusionner(esp(), s, config);
    assert.deepEqual(e.taches[0].mail, { fil: 'g1:f1', sujet: 'Devis', contact: 'Paul', adresse: 'paul@martin.fr', lien: 'https://mail/f1', source: 'gmail' });
    assert.equal(e.relances[0].mail?.fil, 'g1:f2');
    assert.equal(cleFil(m('x', { fil: 'f1' })), e.taches[0].mail?.fil);
  });
  it('éléments déjà là : rattachés, sauf s’ils ont été détachés', () => {
    const e = fusionner(esp({ taches: [tac('ext:g1:msg1')], relances: [rel('ext:g1:f2', { mailsEcartes: ['g1:f2'] })] }), s, config);
    assert.equal(e.taches[0].mail?.fil, 'g1:f1');
    assert.equal(e.relances[0].mail, undefined);
  });
});

describe('référence du fil d’un lien', () => {
  it('sépare le compte connecté du fil, au premier deux-points', () => {
    assert.deepEqual(refLien({ fil: 'cm1:AAQkAD:x==' }), { compte: 'cm1', fil: 'AAQkAD:x==' });
  });
  it('rien sans compte ou sans fil', () => {
    assert.equal(refLien({ fil: 'gmail' }), null);
    assert.equal(refLien({ fil: ':abc' }), null);
    assert.equal(refLien({ fil: 'cm1:' }), null);
    assert.equal(refLien(undefined), null);
  });
});
