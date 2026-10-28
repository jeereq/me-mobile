import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evtsDuMembre, evenementsEntre } from '../src/lib/calendrier-global.ts';
import { comptesParFiltre, elementsDePlan, elementsDeTaches, estDeMembre, filtreDeMembre, initiales, libelleFiltre, parMembre, proprietaireParDefaut, responsableDe } from '../src/lib/equipe-taches.ts';
import type { Espace, Tache } from '../src/lib/types.ts';

const AUJ = '2026-10-28';
const alice = { id: 'u1', nom: 'Alice Mbala', email: 'alice@ex.cd', role: 'PROPRIETAIRE' as const, depuisLe: '2026-01-01' };
const bob = { id: 'u2', nom: '', email: 'bob@ex.cd', role: 'MEMBRE' as const, depuisLe: '2026-01-02' };
const carine = { id: 'u3', nom: 'Carine', email: 'c@ex.cd', role: 'LECTEUR' as const, depuisLe: '2026-01-03' };
const membres = [bob, alice, carine];

const t = (id: string, x: Partial<Tache> = {}): Tache => ({ id, titre: id, source: 'manuel', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'normal', creeLe: '2026-10-01T00:00:00Z', ...x }) as Tache;

const taches: Tache[] = [
  t('a1', { affecteA: 'u1', responsable: 'Alice Mbala', echeance: '2026-10-30' }),
  t('a2', { affecteA: 'u1', responsable: 'Alice Mbala', echeance: '2026-10-20' }),
  t('a3', { affecteA: 'u1', responsable: 'Alice Mbala', echeance: '2026-12-15' }),
  t('a4', { affecteA: 'u1', responsable: 'Alice Mbala', statut: 'fait', echeance: '2026-10-10' }),
  t('b1', { affecteA: 'u2', responsable: 'bob@ex.cd', echeance: '2026-10-28', priorite: 'haute' }),
  t('b2', { responsable: 'BOB@ex.cd' }),
  t('x1', { responsable: 'Un client', echeance: '2026-11-02' }),
  t('p1', { affecteA: 'parti', responsable: 'Ancien', echeance: '2026-11-03' }),
  t('n1', { echeance: '2026-10-29' }),
];

test('le responsable : le membre, un nom hors équipe, ou personne', () => {
  assert.deepEqual(responsableDe(taches[0], membres, 'u1'), { nom: 'Alice Mbala', membre: alice, moi: true, parti: false });
  assert.equal(responsableDe(taches[4], membres, 'u1')?.moi, false);
  assert.equal(responsableDe(taches[5], membres, 'u1')?.membre?.id, 'u2');
  assert.deepEqual(responsableDe(taches[6], membres, 'u1'), { nom: 'Un client', membre: null, moi: false, parti: false });
  assert.deepEqual(responsableDe(taches[7], membres, 'u1'), { nom: 'Ancien', membre: null, moi: false, parti: true });
  assert.equal(responsableDe(taches[8], membres, 'u1'), null);
});

test('les filtres : moi, un membre, non affectées', () => {
  assert.equal(estDeMembre(taches[0], 'moi', membres, 'u1'), true);
  assert.equal(estDeMembre(taches[4], 'moi', membres, 'u1'), false);
  assert.equal(estDeMembre(taches[4], filtreDeMembre('u2'), membres, 'u1'), true);
  assert.equal(estDeMembre(taches[0], filtreDeMembre('u2'), membres, 'u1'), false);
  assert.equal(estDeMembre(taches[8], 'non', membres, 'u1'), true);
  assert.equal(estDeMembre(taches[6], 'non', membres, 'u1'), false);
  assert.equal(estDeMembre(taches[8], 'tous', membres, 'u1'), true);
});

test('les initiales d’un nom ou d’une adresse', () => {
  assert.equal(initiales('Alice Mbala'), 'AM');
  assert.equal(initiales('carine'), 'CA');
  assert.equal(initiales('bob@ex.cd'), 'BO');
  assert.equal(initiales('jean-paul.kabila'), 'JP');
  assert.equal(initiales('  '), '?');
});

test('le travail de chacun : moi d’abord, tous les membres, le retard et les échéances', () => {
  const g = parMembre(elementsDeTaches(taches), membres, 'u1', AUJ);
  assert.deepEqual(g.map((x) => x.cle), ['m:u1', 'm:u2', 'm:u3', 'ext:ancien', 'ext:un client', 'non']);
  const [moi, b, c, , , non] = g;
  assert.equal(moi.moi, true);
  // Alice : une en retard, une cette semaine, une lointaine ; la terminée est comptée à part.
  assert.deepEqual(moi.ouvertes.map((x) => x.id), ['a2', 'a1', 'a3']);
  assert.deepEqual(moi.parGenre, { tache: 3, relance: 0, rdv: 0 });
  assert.equal(moi.enRetard, 1);
  assert.equal(moi.cetteSemaine, 1);
  assert.equal(moi.faites, 1);
  assert.equal(moi.prochaine, '2026-10-30');
  // Bob : sa tâche du jour, et celle sans échéance à part.
  assert.deepEqual(b.ouvertes.map((x) => x.id), ['b1']);
  assert.deepEqual(b.sansEcheance.map((x) => x.id), ['b2']);
  assert.equal(b.nom, 'bob@ex.cd');
  // Un membre sans tâche reste visible.
  assert.deepEqual([c.nom, c.ouvertes.length, c.prochaine], ['Carine', 0, null]);
  assert.deepEqual(non.ouvertes.map((x) => x.id), ['n1']);
});

test('limiter à une période garde le retard et masque le lointain', () => {
  const [moi] = parMembre(elementsDeTaches(taches), membres, 'u1', AUJ, '2026-11-04');
  assert.deepEqual(moi.ouvertes.map((x) => x.id), ['a2', 'a1']);
  // Les compteurs ne dépendent pas de la période.
  assert.equal(moi.enRetard, 1);
});

test('une tâche résumé de projet ne compte pas, ses sous-tâches oui', () => {
  const l = [t('r', { affecteA: 'u1', responsable: 'Alice Mbala', echeance: '2026-11-01' }), t('s', { parent: 'r', affecteA: 'u1', responsable: 'Alice Mbala', echeance: '2026-10-31' })];
  const [moi] = parMembre(elementsDeTaches(l), membres, 'u1', AUJ);
  assert.deepEqual(moi.ouvertes.map((x) => x.id), ['s']);
});

test('les compteurs des puces', () => {
  const n = comptesParFiltre(elementsDeTaches(taches), membres, 'u1');
  assert.equal(n.get('tous'), 8);
  assert.equal(n.get('moi'), 3);
  assert.equal(n.get(filtreDeMembre('u1')), 3);
  assert.equal(n.get(filtreDeMembre('u2')), 2);
  assert.equal(n.get(filtreDeMembre('u3')), 0);
  assert.equal(n.get('non'), 1);
});

test('le libellé du filtre', () => {
  assert.equal(libelleFiltre('moi', membres), 'Mes tâches');
  assert.equal(libelleFiltre(filtreDeMembre('u1'), membres), 'Tâches de Alice Mbala');
  assert.equal(libelleFiltre('non', membres), 'Tâches non affectées');
});

test('le calendrier d’un membre ne garde que ses tâches', () => {
  const e = { taches, relances: [], habitudes: [], agenda: { '2026-10-30': [{ titre: 'Réunion', debut: '09:00' }] }, sources: {} } as unknown as Espace;
  const tout = evenementsEntre(e, '2026-10-01', '2026-11-30', AUJ);
  assert.ok(tout.some((x) => x.genre === 'agenda'));
  assert.equal(evtsDuMembre(tout, 'tous', membres, 'u1').length, tout.length);
  const alice30 = evtsDuMembre(tout, filtreDeMembre('u1'), membres, 'u1');
  assert.deepEqual(alice30.map((x) => x.ref?.id).sort(), ['a1', 'a2', 'a4']);
  assert.ok(alice30.every((x) => x.genre === 'tache'));
  // Sans propriétaire : la tâche n1, et le rendez-vous sans identifiant (importé), pas les autres.
  assert.deepEqual(evtsDuMembre(tout, 'non', membres, 'u1').map((x) => x.ref?.id ?? x.genre).sort(), ['agenda', 'n1']);
  // Les événements portent le responsable, pour l'afficher sur la ligne.
  assert.equal(tout.find((x) => x.ref?.id === 'a1')?.affecteA, 'u1');
});

const espaceEquipe = {
  taches: [t('t1', { affecteA: 'u1', responsable: 'Alice Mbala', echeance: '2026-10-30' })],
  relances: [
    { id: 'r1', contact: 'Marie', sujet: 'Devis du site', boite: 'pro', date: '2026-10-29', statut: 'a_faire', mode: 'normal', creeLe: '', affecteA: 'u2', responsable: 'bob@ex.cd' },
    { id: 'r2', contact: 'Paul', sujet: '', boite: 'pro', date: '2026-10-25', statut: 'repondu', mode: 'normal', creeLe: '' },
    { id: 'r3', contact: 'Zoé', sujet: 'Facture', boite: 'pro', date: '2026-10-20', statut: 'a_faire', mode: 'normal', creeLe: '' },
  ],
  agenda: {
    '2026-10-20': [{ id: 'me:vieux', debut: '09:00', titre: 'Passé', affecteA: 'u1' }],
    '2026-10-29': [
      { id: 'me:r1', debut: '14:00', titre: 'Point client', lieu: 'Bureau', affecteA: 'u1', responsable: 'Alice Mbala' },
      { debut: '10:00', titre: 'Importé sans identifiant' },
    ],
  },
} as unknown as Espace;

test('les éléments du plan : tâches, relances et rendez-vous à venir avec identifiant', () => {
  const l = elementsDePlan(espaceEquipe, AUJ);
  assert.deepEqual(l.map((x) => x.cle), ['tache:t1', 'relance:r1', 'relance:r2', 'relance:r3', 'rdv:me:r1']);
  const rdv = l.find((x) => x.genre === 'rdv')!;
  assert.deepEqual([rdv.date, rdv.heure, rdv.detail, rdv.affecteA], ['2026-10-29', '14:00', 'Bureau', 'u1']);
  assert.equal(l.find((x) => x.cle === 'relance:r2')?.fait, true);
  assert.equal(l.find((x) => x.cle === 'relance:r1')?.titre, 'Relancer Marie');
});

test('chacun voit ses tâches, ses relances et ses rendez-vous, rangés par jour puis par heure', () => {
  const g = parMembre(elementsDePlan(espaceEquipe, AUJ), membres, 'u1', AUJ);
  const [moi, b, , non] = g;
  assert.deepEqual(moi.ouvertes.map((x) => x.cle), ['rdv:me:r1', 'tache:t1']);
  assert.deepEqual(moi.parGenre, { tache: 1, relance: 0, rdv: 1 });
  assert.deepEqual(b.ouvertes.map((x) => x.cle), ['relance:r1']);
  // Une relance obtenue ne compte pas ; une relance en retard sans responsable est « non affectée ».
  assert.equal(b.faites, 0);
  assert.equal(non.cle, 'non');
  assert.deepEqual(non.ouvertes.map((x) => x.cle), ['relance:r3']);
  assert.equal(non.enRetard, 1);
});

test('le filtre « non » compte aussi les relances et rendez-vous sans propriétaire', () => {
  const n = comptesParFiltre(elementsDePlan(espaceEquipe, AUJ), membres, 'u1');
  assert.equal(n.get('moi'), 2);
  assert.equal(n.get('non'), 1);
  assert.equal(n.get('tous'), 4);
});

test('ce que je crée dans une équipe est à moi par défaut', () => {
  assert.deepEqual(proprietaireParDefaut(membres, 'u1'), { affecteA: 'u1', responsable: 'Alice Mbala' });
  assert.deepEqual(proprietaireParDefaut(membres, 'u2'), { affecteA: 'u2', responsable: 'bob@ex.cd' });
  assert.deepEqual(proprietaireParDefaut(membres, 'inconnu'), {});
  assert.deepEqual(proprietaireParDefaut(membres, undefined), {});
});

test('le libellé du filtre selon ce qu’on regarde', () => {
  assert.equal(libelleFiltre('moi', membres, 'relance'), 'Mes relances');
  assert.equal(libelleFiltre('non', membres, 'relance'), 'Relances non affectées');
  assert.equal(libelleFiltre(filtreDeMembre('u1'), membres, 'tout'), 'Ce qui est à Alice Mbala');
});
