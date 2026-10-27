import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { adresseDictee, adresseEmail, boitesDeMails, comptesDeMails, decouperCitation, libellesDeMails, morceauxTexte, nomBoite, premiereLigne, destinataire, filtrerMails, grouperMails, nonLus, initiales, objetDepuisTexte, quandCourt, resumeMails, teinteContact, titreJourMail, trouverMail, type Mail } from '../src/lib/mails.ts';

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

describe('retrouver un contact et dicter une adresse', () => {
  const liste = [
    m('a', { contact: 'Paul Martin', adresse: 'Paul Martin <paul@boite.com>', heure: '09:00' }),
    m('b', { contact: 'Paul Martin', adresse: 'Paul Martin <paul@boite.com>', heure: '11:00', sujet: 'Réunion' }),
    m('c', { contact: 'Élodie', adresse: 'elodie@ex.fr', sujet: 'Facture octobre' }),
  ];
  it('le mail le plus récent du contact, sinon par l’objet', () => {
    assert.equal(trouverMail(liste, 'paul')?.id, 'b');
    assert.equal(trouverMail(liste, 'elodie')?.id, 'c');
    assert.equal(trouverMail(liste, 'la facture')?.id, 'c');
    assert.equal(trouverMail(liste, 'Jacques'), null);
  });
  it('l’adresse d’un contact, dite ou tapée', () => {
    assert.deepEqual(destinataire(liste, 'Paul'), { nom: 'Paul Martin', adresse: 'paul@boite.com' });
    assert.deepEqual(destinataire(liste, 'Bob <BOB@ex.fr>'), { nom: 'BOB@ex.fr', adresse: 'bob@ex.fr' });
    assert.equal(destinataire(liste, 'facture'), null);
    assert.equal(adresseDictee('paul tiret martin arobase gmail point com'), 'paul-martin@gmail.com');
    assert.equal(adresseDictee('Paul'), null);
    assert.equal(adresseEmail('Paul <p@x.fr>'), 'p@x.fr');
  });
  it('résume les non lus pour la voix', () => {
    assert.match(resumeMails([m('x', { nonLu: true }), m('y', { nonLu: true, contact: 'Paul' })]), /^2 mails non lus\./);
    assert.match(resumeMails([m('x')]), /^Aucun mail non lu\. Les derniers : Marie Dupont : Objet x\.$/);
    assert.match(resumeMails([]), /Aucun mail récent/);
  });
  it('tire un objet court du message', () => {
    assert.equal(objetDepuisTexte('la réunion est décalée. Merci'), 'La réunion est décalée');
    assert.ok(objetDepuisTexte('a'.repeat(30) + ' ' + 'b'.repeat(40)).endsWith('…'));
  });
});

describe('affichage façon Outlook', () => {
  it('l’heure aujourd’hui, « Hier », le jour sur une semaine, sinon la date', () => {
    assert.equal(quandCourt({ date: J, heure: '15:42' }, J), '15:42');
    assert.equal(quandCourt({ date: '2026-10-26' }, J), 'Hier');
    assert.equal(quandCourt({ date: '2026-10-23' }, J), 'Ven');
    assert.match(quandCourt({ date: '2026-09-02' }, J), /^2 sept/);
    assert.equal(quandCourt({ date: '' }, J), '');
  });
  it('initiales et couleur stable', () => {
    assert.equal(initiales('Marie Dupont'), 'MD');
    assert.equal(initiales('Élodie Kabasele'), 'ÉK');
    assert.equal(initiales('canal+'), 'C');
    assert.equal(initiales('paul.martin@boite.com'), 'PM');
    assert.equal(initiales(''), '?');
    assert.equal(teinteContact('Marie', 6), teinteContact('marie', 6));
    assert.ok(teinteContact('Paul', 6) < 6);
  });
});

describe('boîtes partagées et étiquettes', () => {
  const liste = [
    m('a', { nonLu: true, libelles: ['Facture'] }),
    m('b', { compte: 'moi@boite.com', boite: 'ventes@boite.com', nonLu: true, libelles: ['Client', 'facture'] }),
    m('c', { compte: 'moi@boite.com', boite: 'ventes@boite.com', extrait: 'Voici le bon de commande' }),
    m('d', { compte: 'moi@boite.com' }),
  ];
  it('filtre par boîte : la partagée ne se mêle pas à celle du compte', () => {
    assert.deepEqual(ids(filtrerMails(liste, { compte: 'ventes@boite.com' })), ['b', 'c']);
    assert.deepEqual(ids(filtrerMails(liste, { compte: 'moi@boite.com' })), ['d']);
  });
  it('filtre par étiquette, sans casse', () => {
    assert.deepEqual(ids(filtrerMails(liste, { libelle: 'FACTURE' })), ['a', 'b']);
  });
  it('cherche aussi dans l’extrait et les étiquettes', () => {
    assert.deepEqual(ids(filtrerMails(liste, { q: 'bon de commande' })), ['c']);
    assert.deepEqual(ids(filtrerMails(liste, { q: 'client' })), ['b']);
  });
  it('liste les boîtes des comptes, puis les partagées, avec leurs non lus', () => {
    assert.deepEqual(
      boitesDeMails(liste).map((b) => [b.adresse, b.partagee, b.nombre, b.nonLus]),
      [
        ['moi@boite.com', false, 1, 0],
        ['moi@gmail.com', false, 1, 1],
        ['ventes@boite.com', true, 2, 1],
      ],
    );
  });
  it('compte les étiquettes, les plus utilisées d’abord', () => {
    assert.deepEqual(libellesDeMails(liste), [{ nom: 'Facture', nombre: 2 }, { nom: 'Client', nombre: 1 }]);
  });
  it('nomme une boîte partagée par son adresse', () => {
    assert.equal(nomBoite('service-client@boite.com'), 'Service client');
  });
});

describe('affichage d’un message', () => {
  it('replie la réponse citée de Gmail', () => {
    const r = decouperCitation("C'est d'accord.\n\nLe lun. 27 oct. 2026 à 10:02, Paul Martin <paul@ex.fr> a écrit :\n> Tu valides ?");
    assert.equal(r.corps, "C'est d'accord.");
    assert.match(r.cite, /^Le lun\./);
  });
  it('replie le bloc De / Envoyé d’Outlook et le « wrote » anglais', () => {
    assert.equal(decouperCitation('Merci !\nDe : Paul <paul@ex.fr>\nEnvoyé : lundi\nObjet : Devis').corps, 'Merci !');
    assert.equal(decouperCitation('Thanks\nOn Mon, Oct 27, 2026 at 10:02 Paul wrote:\n> ok').corps, 'Thanks');
  });
  it('replie une suite de lignes « > », mais pas une ligne isolée', () => {
    assert.equal(decouperCitation('Oui\n> a\n> b').corps, 'Oui');
    assert.equal(decouperCitation('Voir :\n> une note\nEt la suite de mon texte\nencore\net encore').cite, '');
  });
  it('ne vide jamais un mail qui n’est qu’une citation', () => {
    const t = '> tout est cité';
    assert.deepEqual(decouperCitation(t), { corps: t, cite: '' });
  });
  it('rend touchables liens, adresses et numéros', () => {
    const r = morceauxTexte('Voir https://ex.fr/devis. Écris à paul@ex.fr ou appelle le +243 81 234 5678, le 2026-10-27.');
    assert.deepEqual(
      r.filter((x) => x.t !== 'texte'),
      [
        { t: 'lien', v: 'https://ex.fr/devis' },
        { t: 'mail', v: 'paul@ex.fr' },
        { t: 'tel', v: '+243 81 234 5678' },
      ],
    );
    assert.equal(r.map((x) => x.v).join(''), 'Voir https://ex.fr/devis. Écris à paul@ex.fr ou appelle le +243 81 234 5678, le 2026-10-27.');
  });
  it('la première ligne utile, sans la citation', () => {
    assert.equal(premiereLigne('\n  Bonjour Paul,\nsuite\nLe 3 oct., Marie a écrit :\n> x'), 'Bonjour Paul,');
  });
});
