import assert from 'node:assert/strict';
import { test } from 'node:test';

import { brouillonMailTache, membreDe, nomMembre, patchAffectation } from '../src/lib/affectation.ts';

const alice = { id: 'u1', nom: 'Alice Mbala', email: 'alice@ex.cd', role: 'PROPRIETAIRE' as const, depuisLe: '2026-01-01' };
const bob = { id: 'u2', nom: '', email: 'bob@ex.cd', role: 'MEMBRE' as const, depuisLe: '2026-01-02' };
const membres = [alice, bob];

test('le nom affiché d’un membre : son nom, sinon son email', () => {
  assert.equal(nomMembre(alice), 'Alice Mbala');
  assert.equal(nomMembre(bob), 'bob@ex.cd');
});

test('le membre d’une tâche : par son compte, sinon par le nom d’une ancienne tâche', () => {
  assert.equal(membreDe(membres, { affecteA: 'u2' })?.id, 'u2');
  assert.equal(membreDe(membres, { responsable: ' alice mbala ' })?.id, 'u1');
  assert.equal(membreDe(membres, { responsable: 'Un client' }), null);
  assert.equal(membreDe(membres, {}), null);
  // Un compte qui a quitté l'équipe : plus de membre, même si le nom est resté.
  assert.equal(membreDe(membres, { affecteA: 'parti', responsable: 'Alice Mbala' }), null);
});

test('choisir un membre pose son compte et son nom', () => {
  assert.deepEqual(patchAffectation(membres, {}, alice), { affecteA: 'u1', responsable: 'Alice Mbala' });
  assert.deepEqual(patchAffectation(membres, { affecteA: 'u1', responsable: 'Alice Mbala' }, bob), { affecteA: 'u2', responsable: 'bob@ex.cd' });
});

test('retirer la personne efface le nom d’un membre, pas un responsable écrit à la main', () => {
  assert.deepEqual(patchAffectation(membres, { affecteA: 'u1', responsable: 'Alice Mbala' }, null), { affecteA: undefined, responsable: undefined });
  assert.deepEqual(patchAffectation(membres, { responsable: 'Un client' }, null), { affecteA: undefined, responsable: 'Un client' });
});

test('le mail d’une tâche confiée à un membre est adressé à ce membre', () => {
  const b = brouillonMailTache({ titre: 'Envoyer le devis', echeance: '2026-11-05', note: 'Version à 3 000 $' }, alice);
  assert.equal(b.a, 'alice@ex.cd');
  assert.equal(b.sujet, 'Tâche : Envoyer le devis');
  assert.equal(b.texte, 'Bonjour Alice,\n\nAu sujet de la tâche « Envoyer le devis » (à faire pour le 05/11/2026).\n\nVersion à 3 000 $\n\n');
});

test('sans membre, l’adresse reste à écrire ; sans échéance ni note, le texte est court', () => {
  const b = brouillonMailTache({ titre: 'Appeler le client', echeance: null }, null);
  assert.equal('a' in b, false);
  assert.equal(b.texte, 'Bonjour,\n\nAu sujet de la tâche « Appeler le client ».\n\n');
});

test('un membre sans nom : « Bonjour » sans prénom', () => {
  assert.equal(brouillonMailTache({ titre: 'X', echeance: null }, bob).texte.startsWith('Bonjour,\n'), true);
});
