import assert from 'node:assert/strict';
import { test } from 'node:test';

import { comprendre } from '../src/lib/commande.ts';
import type { Mail } from '../src/lib/mails.ts';
import { correspondance, direMailsDe, direSynthese, lireDemandeMails, mailsDePersonne, periodeDite, trouverPersonne } from '../src/lib/mails-voix.ts';
import type { Espace } from '../src/lib/types.ts';

const D = '2026-11-02';
const espace = (x: Partial<Espace> = {}): Espace =>
  ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: {} as Espace['audio'], majLe: '', finances: { devise: '€', budgets: [], depenses: [] }, ...x }) as Espace;
const mail = (id: string, contact: string, x: Partial<Mail> = {}): Mail => ({ id, sujet: `Sujet ${id}`, contact, date: '2026-10-30', sens: 'recu', source: 'gmail', ctx: 'pro', ...x });
const MAILS = [
  mail('ext:g:1', 'Joseph Niandou', { adresse: 'joseph.niandou@acme.cd', sujet: 'Contrat de maintenance', extrait: 'Bonjour, voici le contrat signé', date: '2026-10-31', nonLu: true }),
  mail('ext:g:2', 'Joseph Niandou', { adresse: 'joseph.niandou@acme.cd', sujet: 'Facture octobre', date: '2026-10-12' }),
  mail('ext:g:3', 'Joseph Kabila', { adresse: 'jk@exemple.cd', sujet: 'Réunion', date: '2026-11-01' }),
  mail('ext:g:4', 'Paul Martin', { adresse: 'paul@exemple.fr', sujet: 'Le devis du site', date: '2026-11-02' }),
  mail('ext:g:5', 'Joseph Niandou', { adresse: 'joseph.niandou@acme.cd', sujet: 'Re: Contrat', date: '2026-10-31', sens: 'envoye' }),
];

test('la phrase de jeereq : lire les mails d’une personne puis les résumer, en une commande', () => {
  const c = comprendre('Lis mes mails concernant Joseph Niandou et fais-moi un résumé dessus', espace(), D, MAILS);
  assert.equal(c.type, 'mailsDe');
  if (c.type !== 'mailsDe') return;
  assert.equal(c.nom, 'Joseph Niandou');
  assert.equal(c.resume, true);
  // Les mails reçus de lui et ceux qu'on lui a envoyés, les plus récents d'abord ; pas l'autre Joseph.
  assert.deepEqual(c.mails.map((m) => m.id), ['ext:g:1', 'ext:g:5', 'ext:g:2']);
  assert.deepEqual(c.recherche, { genre: 'personne', qui: 'joseph.niandou@acme.cd' });
});

test('les autres façons de le dire', () => {
  const resumes = [
    'Résume mes mails avec Joseph Niandou',
    'Fais-moi un résumé de mes mails de Joseph Niandou',
    'Donne-moi un résumé des échanges avec Joseph Niandou',
    "Qu'est-ce que Joseph Niandou m'a écrit ?",
    'Lis les mails de Joseph Niandou et résume-les',
    'Hey Me, peux-tu lire mes mails à propos de Joseph Niandou et me faire une synthèse ?',
    'Lis mes messages reçus de Monsieur Niandou puis fais-moi un récap',
    'Fais une synthèse des mails envoyés par Niandou',
  ];
  for (const t of resumes) {
    const c = comprendre(t, espace(), D, MAILS);
    assert.ok(c.type === 'mailsDe' && c.resume && c.nom === 'Joseph Niandou', `${t} → ${JSON.stringify(c).slice(0, 120)}`);
  }
  for (const t of ['Lis mes mails de Joseph Niandou', 'Montre-moi les mails de Niandou', "Est-ce que Joseph Niandou m'a écrit ?"]) {
    const c = comprendre(t, espace(), D, MAILS);
    assert.ok(c.type === 'mailsDe' && !c.resume && c.nom === 'Joseph Niandou', `${t} → ${JSON.stringify(c).slice(0, 120)}`);
  }
});

test('un nom écorché par la dictée retrouve quand même la personne', () => {
  for (const dit of ['Joseph Nian dou', 'joseph niandu', 'Niandou', 'Joseph Nyandou', 'joseph niandou']) {
    assert.equal(trouverPersonne(dit, MAILS)?.nom, 'Joseph Niandou', dit);
  }
  // « Joseph » seul : celui avec qui l'on échange le plus.
  assert.equal(trouverPersonne('Joseph', MAILS)?.nom, 'Joseph Niandou');
  assert.equal(trouverPersonne('Joseph Kabila', MAILS)?.nom, 'Joseph Kabila');
  assert.equal(trouverPersonne('Marie Curie', MAILS), null);
  assert.ok(correspondance('Paul', { nom: 'Paul Martin' }) === 1);
  assert.ok(correspondance('Pierre', { nom: 'Paul Martin' }) < 0.95);
  // Un contact de Me sans mail récent : reconnu, la recherche dans les comptes fera le reste.
  const c = comprendre('Résume mes mails avec Sophie Lemaire', espace({ contacts: [{ id: 'c1', nom: 'Sophie Lemaire', organisation: '', dernierEchange: '' }] }), D, MAILS);
  assert.ok(c.type === 'mailsDe' && c.nom === 'Sophie Lemaire' && !c.mails.length && c.recherche?.qui === 'Sophie Lemaire');
});

test('une personne inconnue de la boîte récente : recherche dans les comptes ; un sujet : les mails qui en parlent', () => {
  const c = comprendre('Résume mes mails concernant Marie Curie', espace(), D, MAILS);
  assert.ok(c.type === 'mailsDe' && c.nom === 'Marie Curie' && !c.mails.length && c.recherche?.qui === 'marie curie');
  const s = comprendre('Lis mes mails concernant le devis', espace(), D, MAILS);
  assert.ok(s.type === 'mailsDe' && s.mails.length === 1 && s.mails[0].id === 'ext:g:4' && !s.recherche);
});

test('la période dite borne les mails', () => {
  assert.deepEqual(periodeDite('cette semaine', D), { depuis: '2026-10-27' });
  assert.deepEqual(periodeDite('le mois dernier', D), { depuis: '2026-10-01', jusqua: '2026-10-31' });
  assert.deepEqual(periodeDite('ce mois-ci', D), { depuis: '2026-11-01' });
  assert.deepEqual(periodeDite('les 3 derniers jours', D), { depuis: '2026-10-31' });
  assert.deepEqual(periodeDite('hier', D), { depuis: '2026-11-01', jusqua: '2026-11-01' });
  const x = lireDemandeMails("resume mes mails de joseph niandou de cette semaine", D);
  assert.deepEqual(x, { qui: 'joseph niandou', resume: true, depuis: '2026-10-27' });
  const c = comprendre('Résume mes mails de Joseph Niandou du mois dernier', espace(), D, MAILS);
  assert.ok(c.type === 'mailsDe');
  if (c.type === 'mailsDe') {
    assert.deepEqual(c.mails.map((m) => m.id), ['ext:g:1', 'ext:g:5', 'ext:g:2']);
    assert.deepEqual(c.recherche, { genre: 'personne', qui: 'joseph.niandou@acme.cd', depuis: '2026-10-01', jusqua: '2026-10-31' });
  }
  assert.deepEqual(mailsDePersonne(MAILS, { nom: 'Joseph Niandou' }, { depuis: '2026-10-20' }).map((m) => m.id), ['ext:g:1', 'ext:g:5']);
});

test('les commandes mail qui marchaient déjà ne changent pas', () => {
  assert.equal(comprendre('Lis le mail de Paul', espace(), D, MAILS).type, 'lireMail');
  assert.equal(comprendre('Lis mes mails', espace(), D, MAILS).type, 'reponse');
  assert.equal(comprendre('Lis les mails de la boîte ventes', espace(), D, MAILS).type, 'reponse');
  assert.equal(comprendre("Mes mails avec l'étiquette client", espace(), D, MAILS).type, 'reponse');
  assert.equal(comprendre('Écris un mail à Paul pour lui dire que c’est bon', espace(), D, MAILS).type, 'ecrireMail');
  assert.equal(comprendre('Réponds à Paul que c’est bon', espace(), D, MAILS).type, 'repondreMail');
  // Une tâche qui parle de mails reste une tâche.
  const t = comprendre('Ajoute une tâche lire les mails de Paul', espace(), D, MAILS);
  assert.equal(t.type, 'ajout');
  // Le mail d'une personne, avec un résumé demandé : résumé, pas « Je ne trouve pas Paul et fais-moi un résumé ».
  const r = comprendre('Lis le mail de Paul et fais-moi un résumé', espace(), D, MAILS);
  assert.ok(r.type === 'mailsDe' && r.resume && r.nom === 'Paul Martin');
});

test('ce que dit la voix', () => {
  const l = mailsDePersonne(MAILS, { nom: 'Joseph Niandou' });
  const t = direMailsDe('Joseph Niandou', l, D);
  assert.match(t, /^3 mails concernant Joseph Niandou, dont 1 non lu\. Le 31 octobre : Contrat de maintenance\. Bonjour, voici le contrat signé\./);
  assert.match(t, /Le 31 octobre, tu as écrit : Re: Contrat\./);
  assert.equal(direMailsDe('Marie', [], D), 'Je ne trouve aucun mail concernant Marie.');
  assert.equal(
    direSynthese('Joseph Niandou', { synthese: 'Joseph attend la signature du contrat.', points: ['Facture de 1 200 € à régler.'] }, 14, 10),
    "J'ai lu les 10 plus récents de tes 14 mails avec Joseph Niandou. Joseph attend la signature du contrat. À retenir : Facture de 1 200 € à régler.",
  );
  assert.match(direSynthese('Paul', { synthese: 'Un devis.', points: [] }, 1, 1), /^J'ai lu ton mail avec Paul\. Un devis\.$/);
});
