import assert from 'node:assert/strict';
import { test } from 'node:test';

import { accueille, echeanceDepassee, estMajeur, etatMembre, jourMois, lireDateNaissance, resumeGroupes, situationGroupe, pretADemarrer, suiviPeriode, type Cotisation, type MembreCotisation } from '../src/lib/cotisations';
import { montantCotisation } from '../src/lib/commun/cotisations.ts';
import type { Groupe } from '../src/lib/tontines.ts';

const membre = (id: string, m: Partial<MembreCotisation> = {}): MembreCotisation => ({ id, nom: id, depuis: '2026-10', demandePeriode: null, paiements: [], ...m });
const cotisation = (membres: MembreCotisation[]): Cotisation => ({ id: 'c', titre: 'Tontine', montant: 1000, devise: 'USD', rythme: 'mensuel', archive: false, periode: '2026-11', periodes: ['2026-10', '2026-11'], encaisse: 0, membres });

test('état d’un membre selon la période', () => {
  const paye = membre('a', { paiements: [{ periode: '2026-11', statut: 'paye', mode: 'mobile', montant: 1000 }] });
  assert.equal(etatMembre(paye, '2026-11'), 'paye');
  assert.equal(etatMembre(paye, '2026-10'), 'a_payer');
  assert.equal(etatMembre(membre('b', { paiements: [{ periode: '2026-11', statut: 'en_attente', mode: 'mobile', montant: 1000 }] }), '2026-11'), 'en_attente');
  assert.equal(etatMembre(membre('c', { demandePeriode: '2026-11' }), '2026-11'), 'demande');
  assert.equal(etatMembre(membre('d', { depuis: '2026-11' }), '2026-10'), 'hors');
  assert.equal(etatMembre(membre('e', { depuis: 'unique' }), 'unique'), 'a_payer');
});

test('suivi : montants et personnes à relancer', () => {
  const s = suiviPeriode(
    cotisation([
      membre('a', { paiements: [{ periode: '2026-11', statut: 'paye', mode: 'main', montant: 800 }] }),
      membre('b'),
      membre('c', { demandePeriode: '2026-11' }),
      membre('d', { paiements: [{ periode: '2026-11', statut: 'en_attente', mode: 'mobile', montant: 1000 }] }),
    ]),
    '2026-11',
  );
  assert.equal(s.total, 4);
  assert.equal(s.payes, 1);
  assert.equal(s.recu, 800);
  assert.equal(s.reste, 3000);
  assert.deepEqual(s.aDemander.map((m) => m.id), ['b']);
  // Un membre arrivé plus tard ne compte pas pour les périodes d'avant.
  assert.equal(suiviPeriode(cotisation([membre('z', { depuis: '2026-11' })]), '2026-10').total, 0);
});

test('tontine : démarrage possible seulement si complet et cautions payées', () => {
  const m = (cautionPayee: boolean) => ({ id: 'm', nom: 'M', rang: null, cautionPayee, cautionStatut: null, aCotise: false });
  const base = { etat: 'ouvert' as const, places: 2, paiementOuvert: true };
  assert.equal(pretADemarrer({ ...base, membres: [m(true), m(true)] }), true);
  assert.equal(pretADemarrer({ ...base, membres: [m(true)] }), false);
  assert.equal(pretADemarrer({ ...base, membres: [m(true), m(false)] }), false);
  assert.equal(pretADemarrer({ ...base, paiementOuvert: false, membres: [m(true), m(true)] }), false);
});

test('tontine : échéance dépassée seulement pendant la collecte', () => {
  const tour = (etat: 'collecte' | 'a_verser') => ({ numero: 1, beneficiaire: 'M', pourMoi: false, echeance: '2026-11-10', etat, net: 95 });
  assert.equal(echeanceDepassee({ jour: '2026-11-11', tourCourant: 1, tours: [tour('collecte')] }), true);
  assert.equal(echeanceDepassee({ jour: '2026-11-10', tourCourant: 1, tours: [tour('collecte')] }), false);
  assert.equal(echeanceDepassee({ jour: '2026-11-11', tourCourant: 1, tours: [tour('a_verser')] }), false);
});

test('un groupe accueille jusqu’au démarrage, ou jusqu’à la date de fin pour une raison précise', () => {
  assert.equal(accueille({ mode: 'rotation', etat: 'ouvert', final: null }), true);
  assert.equal(accueille({ mode: 'rotation', etat: 'en_cours', final: null }), false);
  assert.equal(accueille({ mode: 'objectif', etat: 'en_cours', final: null }), true);
  assert.equal(accueille({ mode: 'objectif', etat: 'en_cours', final: { etat: 'a_verser', net: 95, commission: 5 } }), false);
});

test('lit une date de naissance et vérifie l’âge', () => {
  assert.equal(lireDateNaissance('12/05/1990', '2026-11-06'), '1990-05-12');
  assert.equal(lireDateNaissance('1/2/1990', '2026-11-06'), '1990-02-01');
  assert.equal(lireDateNaissance('31/02/1990', '2026-11-06'), null);
  assert.equal(lireDateNaissance('1990-05-12', '2026-11-06'), null);
  assert.equal(lireDateNaissance('01/01/2030', '2026-11-06'), null);
  assert.equal(estMajeur('2008-11-06', '2026-11-06'), true);
  assert.equal(estMajeur('2008-11-07', '2026-11-06'), false);
});

const groupeVu = (o: object) => ({ id: 'g', nom: 'Amis', devise: 'USD', mode: 'rotation', etat: 'en_cours', places: 4, inscrits: 4, tourCourant: 2, collecte: 0, totalPrevu: 0, aPayer: null, enAttente: false, moi: { etat: 'accepte' }, membres: [{ aCotise: true }, { aCotise: true }, { aCotise: false }, { aCotise: false }], tours: [{ numero: 2, beneficiaire: 'Paul Kasongo', pourMoi: false, echeance: '2026-12-09', etat: 'collecte', net: 3800 }, { numero: 3, beneficiaire: 'Toi', pourMoi: true, echeance: '2027-01-06', etat: 'a_venir', net: 3800 }], ...o }) as unknown as Groupe;

test('écrit une date en toutes lettres, avec l’année si elle change', () => {
  assert.equal(jourMois('2026-12-09', '2026-11-06'), '9 décembre');
  assert.equal(jourMois('2027-01-06', '2026-11-06'), '6 janvier 2027');
});

test('résume la situation d’un groupe', () => {
  const jour = '2026-11-06';
  const a = situationGroupe(groupeVu({}), jour);
  assert.deepEqual([a.action, a.ton, a.detail, a.ratio], ['Tu es à jour', 'ok', 'Paul reçoit 38 USD le 9 décembre', 0.5]);
  assert.equal(situationGroupe(groupeVu({ aPayer: { genre: 'cotisation', montant: 1000 } }), jour).action, '10 USD à payer');
  assert.equal(situationGroupe(groupeVu({ aPayer: { genre: 'caution', montant: 1000 } }), jour).action, 'Caution de 10 USD');
  assert.equal(situationGroupe(groupeVu({ aPayer: { genre: 'cotisation', montant: 1000 }, enAttente: true }), jour).ton, 'attente');
  assert.equal(situationGroupe(groupeVu({ moi: { etat: 'demande' } }), jour).action, 'Demande envoyée');
  const ouvert = situationGroupe(groupeVu({ etat: 'ouvert', tourCourant: 0, inscrits: 3, tours: [] }), jour);
  assert.deepEqual([ouvert.action, ouvert.detail], ['1 place à remplir', '3 membres sur 4']);
  assert.match(situationGroupe(groupeVu({ mode: 'objectif', collecte: 21000, totalPrevu: 60000, dateFin: '2026-12-20' }), jour).detail, /210 USD sur 600 USD, jusqu’au 20 décembre/);
});

test('additionne ce qui est à payer par devise, et trouve mon prochain versement', () => {
  const r = resumeGroupes([groupeVu({ aPayer: { genre: 'cotisation', montant: 1000 } }), groupeVu({ aPayer: { genre: 'caution', montant: 500 } }), groupeVu({ aPayer: { genre: 'cotisation', montant: 5000000 }, devise: 'CDF' }), groupeVu({ aPayer: { genre: 'cotisation', montant: 9900 }, enAttente: true })]);
  assert.deepEqual(r.dus, ['15 USD', montantCotisation(5000000, 'CDF')]);
  assert.equal(r.prochain?.echeance, '2027-01-06');
  assert.equal(resumeGroupes([groupeVu({ mode: 'objectif' })]).prochain, null);
});

