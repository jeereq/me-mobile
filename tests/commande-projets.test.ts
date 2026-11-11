import assert from 'node:assert/strict';
import { test } from 'node:test';

import { comprendre } from '../src/lib/commande.ts';
import { direProjet, direProjets, direRetards } from '../src/lib/commande-projets.ts';
import type { Espace, Projet, Tache } from '../src/lib/types.ts';

const D = '2026-11-11';
const proj = (id: string, nom: string, x: Partial<Projet> = {}) => ({ id, nom, emoji: '📁', debut: null, joursOuvres: true, creeLe: D, ...x }) as Projet;
const t = (id: string, projet: string, x: Partial<Tache> = {}): Tache => ({ id, titre: id, source: 'manuel', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'passif', creeLe: D, projet, debut: '2026-11-12', duree: 2, fixe: true, ...x }) as Tache;
const espace = (x: Partial<Espace> = {}): Espace =>
  ({
    relances: [],
    habitudes: [],
    contacts: [],
    journal: {},
    agenda: {},
    sources: {},
    sourcesAutres: [],
    audio: {} as Espace['audio'],
    majLe: '',
    projets: [proj('p1', 'Cybersécurité'), proj('p2', 'Site web'), proj('p3', 'Rentrée scolaire', { archive: true })],
    taches: [
      t('Audit réseau', 'p1', { titre: 'Audit réseau', debut: '2026-11-02', duree: 3, responsable: 'Alice Mbala' }),
      t('Pare-feu', 'p1', { titre: 'Pare-feu', debut: '2026-11-16', duree: 3, responsable: 'Bob Kasongo, Alice Mbala' }),
      t('Cahier', 'p1', { titre: 'Cahier des charges', debut: '2026-10-01', duree: 2, statut: 'fait' }),
      t('Maquette', 'p2', { titre: 'Maquette', debut: '2026-12-01', duree: 2 }),
    ],
    ...x,
  }) as Espace;
const E = espace();
const texte = (phrase: string, e = E) => {
  const c = comprendre(phrase, e, D);
  assert.equal(c.type, 'reponse', `${phrase} → ${c.type}`);
  return c.type === 'reponse' ? c.texte : '';
};

test('où en est un projet : avancement, fin et retards', () => {
  const r = texte('Où en est le projet Cybersécurité ?');
  assert.match(r, /^Le projet Cybersécurité est avancé à \d+ pour cent : 1 tâche faite sur 3\./);
  assert.match(r, /La fin est prévue le 18 novembre, dans 7 jours\./);
  assert.match(r, /1 tâche est en retard\./);
  assert.doesNotMatch(r, /En retard :/, 'la version courte ne détaille pas');
  assert.equal(texte('Où en est Site web ?'), texte('Où en est le projet Site web'));
});

test('lire un projet détaille les retards, la suite et les responsables', () => {
  const r = texte('Lis-moi le projet Cybersécurité');
  assert.match(r, /En retard : Audit réseau, Alice Mbala\./);
  assert.match(r, /À faire ensuite : Pare-feu, Bob Kasongo, Alice Mbala\./);
  assert.match(texte('Lis le projet site web'), /^Le projet Site web est avancé à 0 pour cent : 0 tâche faite sur 1\./);
});

test('mes projets : combien, lesquels en retard, le prochain à finir', () => {
  const r = texte('Où en sont mes projets ?');
  assert.match(r, /^Tu as 2 projets, dont 2 en cours\./);
  assert.match(r, /En retard : Cybersécurité \(1 tâche\)\./);
  assert.match(r, /Le prochain à finir est Cybersécurité, le 18 novembre\./);
  assert.equal(texte('Mes projets'), r);
  assert.equal(texte('Lis-moi mes projets'), r);
});

test("les retards d'un projet ou de tous", () => {
  assert.equal(texte("Qu'est-ce qui est en retard dans le projet Cybersécurité ?"), '1 tâche est en retard dans le projet Cybersécurité : Audit réseau, Alice Mbala, prévue le 4 novembre.');
  assert.match(texte('Quelles tâches sont en retard dans mes projets ?'), /^1 tâche est en retard : Audit réseau, projet Cybersécurité, Alice Mbala, prévue le 4 novembre\.$/);
  assert.equal(texte('Quelles tâches sont en retard dans le projet Site web'), 'Aucune tâche en retard dans le projet Site web.');
});

test('qui fait quoi et ce qui reste', () => {
  assert.equal(texte('Qui est responsable dans le projet Cybersécurité ?'), 'Dans le projet Cybersécurité : Alice Mbala, 2 tâches ; Bob Kasongo, 1 tâche.');
  assert.match(texte('Que reste-t-il à faire dans le projet Site web ?'), /^Dans le projet Site web, à faire : Maquette, pour le 2 décembre\.$/);
});

test('ouvrir un projet, mais « ouvre mes projets » reste la navigation', () => {
  const c = comprendre('Ouvre le projet Site web', E, D);
  assert.equal(c.type, 'aller');
  assert.deepEqual(c.type === 'aller' && c.href, { pathname: '/projets', params: { id: 'p2' } });
  const nav = comprendre('Ouvre mes projets', E, D);
  assert.equal(nav.type, 'aller');
  assert.equal(nav.type === 'aller' && typeof nav.href, 'string');
});

test('créer un projet, et « Annule » le retire', () => {
  const c = comprendre('Crée un projet Lancement du magasin', E, D);
  assert.equal(c.type, 'changer');
  if (c.type !== 'changer') return;
  const apres = c.faire(E);
  assert.equal(apres.projets!.at(-1)!.nom, 'Lancement du magasin');
  assert.equal(apres.projets!.length, 4);
  assert.equal(c.defaire(apres).projets!.length, 3);
  assert.match(texte('Crée un projet Site web'), /existe déjà/);
});

test('ajouter une tâche à un projet, dans les trois façons de le dire', () => {
  for (const phrase of ['Ajoute la tâche appeler Paul au projet Site web', 'Dans le projet Site web, ajoute appeler Paul', 'Ajoute au projet Site web la tâche appeler Paul']) {
    const c = comprendre(phrase, E, D);
    assert.equal(c.type, 'changer', phrase);
    if (c.type !== 'changer') continue;
    const apres = c.faire(E);
    const nouvelle = apres.taches.find((x) => x.titre === 'Appeler Paul');
    assert.ok(nouvelle, phrase);
    assert.equal(nouvelle!.projet, 'p2');
    assert.equal(c.defaire(apres).taches.length, E.taches.length);
  }
  assert.match(texte('Ajoute la tâche appeler Paul au projet Inconnu'), /Je ne trouve pas le projet Inconnu/);
});

test('ce qui ne parle pas de projet reste comme avant', () => {
  assert.equal(comprendre('Ajoute une tâche envoyer le devis demain', E, D).type, 'ajout');
  assert.equal(comprendre("J'ai fini le projet Site web", E, D).type !== 'reponse', true);
  assert.equal(comprendre('Combien il me reste en courses ?', E, D).type, 'reponse');
});

test('les textes lus sont directs', () => {
  assert.equal(direProjet(espace({ taches: [] }), E.projets![0], D), "Le projet Cybersécurité n'a pas encore de tâche.");
  assert.match(direProjets(espace({ projets: [] }), D), /Crée un projet Rentrée/);
  assert.equal(direRetards(espace({ taches: [] }), D), 'Aucune tâche en retard dans tes projets.');
});
