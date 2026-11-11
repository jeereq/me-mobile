import assert from 'node:assert/strict';
import { test } from 'node:test';

import { basculerExecutant, basculerSuivi, brouillonMailTache, executantsDe, membreDe, nomMembre, patchAffectation, patchExecutants, suivisDe } from '../src/lib/affectation.ts';

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

const chloe = { id: 'u3', nom: 'Chloé Ngoy', email: 'chloe@ex.cd', role: 'MEMBRE' as const, depuisLe: '2026-01-03' };
const trois = [alice, bob, chloe];

test('plusieurs exécutants : le premier reste dans affecteA, les noms se joignent', () => {
  const p = basculerExecutant(trois, { affecteA: 'u1', responsable: 'Alice Mbala' }, chloe);
  assert.deepEqual(p, { affecteA: 'u1', executants: ['u1', 'u3'], responsable: 'Alice Mbala, Chloé Ngoy' });
  assert.deepEqual(executantsDe(trois, { affecteA: 'u1', executants: ['u1', 'u3'] }).map((m) => m.id), ['u1', 'u3']);
});

test('retirer un exécutant : le suivant devient le premier, un seul restant n’a plus de liste', () => {
  const t = { affecteA: 'u1', executants: ['u1', 'u3'], responsable: 'Alice Mbala, Chloé Ngoy' };
  assert.deepEqual(basculerExecutant(trois, t, alice), { affecteA: 'u3', executants: undefined, responsable: 'Chloé Ngoy' });
  assert.deepEqual(patchExecutants(trois, t, []), { affecteA: undefined, executants: undefined, responsable: undefined });
});

test('une tâche plus ancienne (nom seul) a pour exécutant le membre de ce nom', () => {
  assert.deepEqual(executantsDe(trois, { responsable: 'bob@ex.cd' }).map((m) => m.id), ['u2']);
  assert.deepEqual(basculerExecutant(trois, { responsable: 'bob@ex.cd' }, chloe), { affecteA: 'u2', executants: ['u2', 'u3'], responsable: 'bob@ex.cd, Chloé Ngoy' });
  // Vider la liste garde un nom écrit à la main qui n'est pas un membre.
  assert.deepEqual(patchExecutants(trois, { responsable: 'Un client' }, []).responsable, 'Un client');
});

test('les suivis : ajout, retrait, et un exécutant ne se suit pas lui-même', () => {
  assert.deepEqual(basculerSuivi({}, bob), { suivis: ['u2'] });
  assert.deepEqual(basculerSuivi({ suivis: ['u2'] }, bob), { suivis: undefined });
  assert.deepEqual(basculerSuivi({ suivis: ['u2'] }, chloe), { suivis: ['u2', 'u3'] });
  assert.deepEqual(basculerSuivi({ affecteA: 'u1' }, alice), {});
  assert.deepEqual(suivisDe(trois, { affecteA: 'u1', suivis: ['u1', 'u2', 'parti'] }).map((m) => m.id), ['u2']);
});

test('devenir exécutant retire du suivi', () => {
  const p = basculerExecutant(trois, { suivis: ['u2', 'u3'] }, bob);
  assert.deepEqual(p.suivis, ['u3']);
  assert.deepEqual(basculerExecutant(trois, { suivis: ['u2'] }, bob).suivis, undefined);
  assert.equal('suivis' in basculerExecutant(trois, { suivis: ['u3'] }, bob), false);
});

test('le mail d’une tâche à plusieurs exécutants leur est adressé à tous', () => {
  const b = brouillonMailTache({ titre: 'Préparer', echeance: null }, [alice, chloe]);
  assert.equal(b.a, 'alice@ex.cd, chloe@ex.cd');
  assert.equal(b.texte.startsWith('Bonjour à tous,\n'), true);
  assert.equal(brouillonMailTache({ titre: 'X', echeance: null }, [alice]).texte.startsWith('Bonjour Alice,'), true);
});
