import assert from 'node:assert/strict';
import { test } from 'node:test';

import { comprendre, type Commande } from '../src/lib/commande.ts';
import { financesDe } from '../src/lib/finances.ts';
import type { Mail } from '../src/lib/mails.ts';
import type { Espace, Finances } from '../src/lib/types.ts';
import { nettoyerDemande, nombresEnChiffres } from '../src/lib/voix-texte.ts';

const D = '2026-10-27'; // un mardi
const finances = (): Finances => ({
  devise: '€',
  budgets: [
    { id: 'b1', nom: 'Courses', emoji: '🛒', montant: 300, periode: 'mois' },
    { id: 'b2', nom: 'Vacances', emoji: '✈️', montant: 1000, periode: 'mois', plan: [{ id: 'p1', nom: 'Billets', montant: 600 }, { id: 'p2', nom: 'Hôtel', montant: 300 }] },
  ],
  depenses: [
    { id: 'd1', montant: 120, budget: 'b1', note: 'Marché', date: '2026-10-05', creeLe: '' },
    { id: 'd2', montant: 200, budget: 'b2', poste: 'p1', note: 'Train', date: '2026-10-10', creeLe: '' },
  ],
  revenus: [{ id: 'r1', montant: 2000, note: 'Salaire', date: '2026-10-01', creeLe: '' }],
  comptes: [
    { id: 'c1', nom: 'Compte courant', emoji: '🏦' },
    { id: 'c2', nom: 'Livret', emoji: '🪙', solde: { montant: 3500, date: '2026-10-20', devise: '€' } },
  ],
  objectifs: [{ id: 'o1', nom: 'Voyage', emoji: '✈️', genre: 'epargne', cible: 1000, depart: 100, debut: '2026-09-01', echeance: '2027-03-01', versements: [] }],
});
const tache = (id: string, titre: string, x: object = {}) => ({ id, titre, source: 'manuel' as const, priorite: 'moyenne' as const, echeance: null, statut: 'en_attente' as const, faitLe: null, mode: 'normal' as const, creeLe: '', ...x });
const relance = (id: string, contact: string, sujet: string, x: object = {}) => ({ id, contact, sujet, boite: 'pro' as const, date: D, statut: 'a_faire' as const, mode: 'normal' as const, creeLe: '', ...x });
const espace = (x: Partial<Espace> = {}): Espace =>
  ({
    relances: [relance('r1', 'Paul Martin', 'le devis')],
    taches: [tache('t1', 'Envoyer le devis', { echeance: D }), tache('t2', 'Ranger le garage', { echeance: '2026-10-28' }), tache('t3', 'Payer la facture', { echeance: '2026-10-20' })],
    habitudes: [{ id: 'h1', nom: 'Sport', categorie: 'perso', frequence: 'quotidien', jour: null, mode: 'normal', coches: ['2026-10-24', '2026-10-25', '2026-10-26'], ordre: 0 }],
    contacts: [],
    journal: {},
    agenda: { '2026-10-28': [{ debut: '14:30', titre: 'Dentiste', lieu: 'Centre-ville' }] },
    sources: {},
    sourcesAutres: [],
    audio: {} as Espace['audio'],
    majLe: '',
    finances: finances(),
    ...x,
  }) as Espace;
const mail = (id: string, x: Partial<Mail> = {}): Mail => ({ id, sujet: 'Devis cuisine', contact: 'Paul Martin', adresse: 'Paul Martin <paul@exemple.fr>', date: D, heure: '09:00', sens: 'recu', source: 'gmail', ctx: 'pro', fil: `f-${id}`, ...x });
const texte = (c: Commande) => (c.type === 'reponse' || c.type === 'changer' ? c.texte : '');
/** Applique un changement puis l'annule : l'espace doit revenir à l'identique. */
function aller_retour(c: Commande, e: Espace) {
  assert.equal(c.type, 'changer');
  if (c.type !== 'changer') throw new Error();
  const apres = c.faire(e);
  assert.deepEqual(c.defaire(apres), e);
  return apres;
}

test('nombres dits en lettres et formules de politesse', () => {
  assert.equal(nombresEnChiffres('douze euros cinquante de courses'), '12,50 euros de courses');
  assert.equal(nombresEnChiffres('quatre-vingt-dix-sept'), '97');
  assert.equal(nombresEnChiffres('deux mille cinq cents'), '2500');
  assert.equal(nombresEnChiffres('ajoute une tâche'), 'ajoute une tâche');
  assert.equal(nettoyerDemande("Hey Me, est-ce que tu peux ouvrir les finances s'il te plaît"), 'Ouvrir les finances');
  assert.equal(nettoyerDemande('Je voudrais savoir combien il me reste'), 'Combien il me reste');
  const c = comprendre("J'ai dépensé vingt-cinq euros de courses", espace(), D);
  assert.ok(c.type === 'ajout' && c.phrase.genre === 'depense' && c.phrase.montant === 25 && c.phrase.budget === 'b1');
});

test('reporter une tâche ou une relance, puis annuler', () => {
  const e = espace();
  const a = comprendre('Reporte le devis à lundi', e, D);
  assert.match(texte(a), /Envoyer le devis : reportée à lundi/);
  assert.equal(aller_retour(a, e).taches[0].echeance, '2026-11-02');
  const b = comprendre('Décale la relance de Paul à demain', e, D);
  assert.equal(aller_retour(b, e).relances[0].date, '2026-10-28');
  const c = comprendre('Repousse le garage de 3 jours', e, D);
  assert.equal(aller_retour(c, e).taches[1].echeance, '2026-10-30');
});

test('supprimer et prioriser', () => {
  const e = espace();
  const a = comprendre('Supprime la tâche ranger le garage', e, D);
  assert.deepEqual(aller_retour(a, e).taches.map((t) => t.id), ['t1', 't3']);
  assert.equal(aller_retour(comprendre("Supprime l'habitude sport", e, D), e).habitudes.length, 0);
  assert.equal(aller_retour(comprendre('Le garage est urgent', e, D), e).taches[1].priorite, 'haute');
  assert.equal(aller_retour(comprendre("Le garage n'est pas urgent", e, D), e).taches[1].priorite, 'basse');
});

test('relances : relancé, réponse reçue, relancer par mail', () => {
  const e = espace();
  assert.deepEqual(comprendre("J'ai relancé Paul", e, D), { type: 'statutRelance', relance: e.relances[0], statut: 'relance' });
  assert.deepEqual(comprendre('Paul m’a répondu', e, D), { type: 'statutRelance', relance: e.relances[0], statut: 'repondu' });
  // Sans mail rattaché : un nouveau mail à son adresse connue.
  const a = comprendre('Relance Paul par mail', e, D, [mail('m1')]);
  assert.ok(a.type === 'ecrireMail' && a.a === 'paul@exemple.fr' && /le devis/.test(a.texte));
  // Rattachée à un mail : une réponse dans le même fil.
  const lie = espace({ relances: [relance('r1', 'Paul Martin', 'le devis', { mail: { fil: 'gmail:f-m1', sujet: 'Devis cuisine' } })] });
  const b = comprendre('Relance Paul par mail', lie, D, [mail('m1')]);
  assert.ok(b.type === 'repondreMail' && b.mail.id === 'm1' && /le devis/.test(b.texte));
});

test('créer une relance ou une tâche depuis un mail, rattachée à lui', () => {
  const e = espace();
  const config = { delaiRelanceJours: 3, defauts: { relance: 'normal', tache: 'normal', facture: 'normal', finance: 'normal', perso: 'normal' } } as const;
  const a = comprendre('Crée une relance pour le mail de Paul', e, D, [mail('m1')], config);
  const apres = aller_retour(a, e);
  assert.equal(apres.relances[0].sujet, 'Devis cuisine');
  assert.equal(apres.relances[0].date, '2026-10-30');
  assert.ok(apres.relances[0].mail?.fil);
  const b = comprendre('Transforme le mail de Paul en tâche', e, D, [mail('m1')], config);
  assert.equal(aller_retour(b, e).taches[0].mail?.sujet, 'Devis cuisine');
  assert.match(texte(comprendre('Crée une tâche depuis le mail de Zoé', e, D, [mail('m1')])), /Je ne trouve pas/);
});

test('revenus, virements, versements et budgets', () => {
  const e = espace();
  const r = comprendre("J'ai reçu 1500 € de prime sur le livret", e, D);
  const f = financesDe(aller_retour(r, e));
  assert.deepEqual([f.revenus![0].montant, f.revenus![0].note, f.revenus![0].compte], [1500, 'Prime', 'c2']);

  const v = comprendre('Vire 200 € du compte courant vers le livret', e, D);
  assert.match(texte(v), /200.*de Compte courant vers Livret/);
  const g = financesDe(aller_retour(v, e));
  assert.deepEqual([g.depenses[0].compte, g.revenus![0].compte, !!g.depenses[0].lien], ['c1', 'c2', true]);
  // L'ordre des comptes suit les mots : « vers le livret depuis le compte courant ».
  const v2 = comprendre('Transfère 50 € vers le livret depuis le compte courant', e, D);
  assert.equal(financesDe(aller_retour(v2, e)).depenses[0].compte, 'c1');

  const o = comprendre('Mets 100 € de côté pour le voyage', e, D);
  assert.match(texte(o), /100.*Voyage.*20 %/);
  assert.equal(financesDe(aller_retour(o, e)).objectifs![0].versements[0].montant, 100);

  const b = comprendre('Crée un budget restaurant de 150 € par mois', e, D);
  assert.deepEqual(financesDe(aller_retour(b, e)).budgets.at(-1)!.nom, 'Restaurant');
  const b2 = comprendre('Fixe le budget courses à 350 € par mois', e, D);
  assert.equal(financesDe(aller_retour(b2, e)).budgets[0].montant, 350);
});

test('une dépense dictée se range dans son poste et son compte', () => {
  const c = comprendre('260 € de billets avec le compte courant', espace(), D);
  assert.ok(c.type === 'ajout' && c.phrase.genre === 'depense');
  if (c.type === 'ajout' && c.phrase.genre === 'depense') assert.deepEqual([c.phrase.budget, c.phrase.poste, c.phrase.compte], ['b2', 'p1', 'c1']);
});

test('questions : postes, comptes, objectifs, revenus, dernières dépenses', () => {
  const e = espace();
  assert.match(texte(comprendre('Combien il reste pour les billets ?', e, D)), /Billets \(budget Vacances\) : 200.*600.*reste 400/);
  assert.match(texte(comprendre("Combien j'ai sur le livret ?", e, D)), /Livret : 3[\s ]?500/);
  assert.match(texte(comprendre('Où en est mon objectif voyage ?', e, D)), /Voyage : 100.*1[\s ]?000.*10 %/);
  assert.match(texte(comprendre("Combien j'ai gagné ce mois-ci ?", e, D)), /reçu 2[\s ]?000/);
  assert.match(texte(comprendre('Mes dernières dépenses', e, D)), /^Tes dernières dépenses : 200/);
  // Le budget nommé reste une question de budget, pas de compte.
  assert.match(texte(comprendre('Combien il me reste sur le budget courses ?', e, D)), /^Courses/);
});

test('agenda, tâches datées et séries', () => {
  const e = espace();
  assert.match(texte(comprendre("Qu'est-ce que j'ai demain ?", e, D)), /Demain, 1 rendez-vous : à 14 h 30, Dentiste\. 1 tâche : Ranger le garage/);
  assert.match(texte(comprendre('Mon prochain rendez-vous', e, D)), /Dentiste, demain à 14 h 30, Centre-ville/);
  assert.match(texte(comprendre('Mes tâches en retard', e, D)), /1 tâche en retard : Payer la facture/);
  assert.match(texte(comprendre('Tâches de demain', e, D)), /Ranger le garage/);
  assert.match(texte(comprendre('Ma série de sport', e, D)), /Sport : 3 jours de suite/);
  // « Qu'est-ce que j'ai à faire » reste la liste des tâches urgentes.
  assert.match(texte(comprendre("Qu'est-ce que j'ai à faire aujourd'hui ?", e, D)), /tâches? urgente/);
});

test('aide et salutation', () => {
  assert.match(texte(comprendre("Qu'est-ce que tu sais faire ?", espace(), D)), /^Je peux ajouter/);
  assert.match(texte(comprendre('Bonjour', espace(), D)), /^Bonjour/);
});

test('mails : le dernier reçu, sans nommer personne', () => {
  const mails = [mail('m1', { date: '2026-10-26' }), mail('m2', { contact: 'Zoé', heure: '11:00' }), mail('m3', { sens: 'envoye', heure: '12:00' })];
  const a = comprendre('Lis mon dernier mail', espace(), D, mails);
  assert.ok(a.type === 'lireMail' && a.mail.id === 'm2');
  const b = comprendre("Réponds au dernier mail que c'est d'accord", espace(), D, mails);
  assert.ok(b.type === 'repondreMail' && b.mail.id === 'm2' && b.texte === "C'est d'accord");
});

test('phrases naturelles : mets à une date, verbe seul, journal', () => {
  const e = espace();
  assert.equal(aller_retour(comprendre('Mets le devis à demain', e, D), e).taches[0].echeance, '2026-10-28');
  // Rien qui s'appelle ainsi : « Mets … demain » reste un ajout.
  assert.equal(comprendre('Mets les poubelles demain', e, D).type, 'ajout');
  const s = comprendre("J'ai fait du sport", e, D);
  assert.ok(s.type === 'cocher' && s.cible.genre === 'habitude');
  assert.deepEqual(comprendre('Note que Paul a signé dans mon journal', e, D), { type: 'journal', texte: 'Paul a signé' });
  const v = comprendre('Je voudrais noter une dépense de quinze euros pour le taxi', e, D);
  assert.ok(v.type === 'ajout' && v.phrase.genre === 'depense' && v.phrase.montant === 15 && v.phrase.note === 'Taxi');
});
