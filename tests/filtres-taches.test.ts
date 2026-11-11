import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CRITERES_VIDES, nbCriteres, nbCriteresPlus, piliersDesTaches, tachesVisibles, type Criteres } from '../src/lib/filtres-taches.ts';
import { planifier } from '../src/lib/planning.ts';
import type { Projet, Tache } from '../src/lib/types.ts';

const J = '2026-11-11';
const projet = { id: 'p', nom: 'Projet', emoji: '📁', debut: null, joursOuvres: true, creeLe: J } as Projet;
const t = (id: string, x: Partial<Tache> = {}): Tache => ({ id, titre: id, source: 'manuel', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'passif', creeLe: J, projet: 'p', debut: '2026-11-12', duree: 2, fixe: true, ...x }) as Tache;
const membres = [
  { id: 'u1', nom: 'Alice', email: 'a@x.cd', role: 'MEMBRE' as const, depuisLe: '2026-01-01' },
  { id: 'u2', nom: 'Bob', email: 'b@x.cd', role: 'MEMBRE' as const, depuisLe: '2026-01-01' },
];
const taches = [
  t('retard1', { titre: 'Audit réseau', debut: '2026-11-02', duree: 3, affecteA: 'u1', responsable: 'Alice', pilier: [2] }),
  t('bientot', { titre: 'Contrat fournisseur', debut: '2026-11-16', duree: 2, affecteA: 'u2', executants: ['u2', 'u1'], responsable: 'Bob, Alice', etat: 'a_valider', pilier: [1, 2] }),
  t('loin', { titre: 'Formation équipe', debut: '2027-03-01', duree: 5, note: 'Salle à réserver', etat: 'bloque' }),
  t('fait1', { titre: 'Cahier des charges', debut: '2026-10-01', duree: 2, statut: 'fait' }),
  t('jalon', { titre: 'Go live', debut: '2026-12-01', duree: 0, jalon: true }),
];
const plan = planifier(taches, projet, J);
const ctx = { aujourdhui: J, membres, moiId: 'u1' };
const ids = (c: Partial<Criteres>, ts = taches, pl = plan) => [...(tachesVisibles(ts, pl, { ...CRITERES_VIDES, ...c }, ctx) ?? new Set(['TOUT']))].sort();

test('sans critère, tout se montre', () => {
  assert.equal(tachesVisibles(taches, plan, CRITERES_VIDES, ctx), null);
  assert.equal(nbCriteres(CRITERES_VIDES), 0);
});

test('par statut : à faire, en retard, faites, jalons', () => {
  assert.deepEqual(ids({ statut: 'afaire' }), ['bientot', 'jalon', 'loin', 'retard1']);
  assert.deepEqual(ids({ statut: 'retard' }), ['retard1']);
  assert.deepEqual(ids({ statut: 'faites' }), ['fait1']);
  assert.deepEqual(ids({ statut: 'jalons' }), ['jalon']);
});

test('recherche : dans le titre, la note et le responsable, sans accents ni casse', () => {
  assert.deepEqual(ids({ recherche: 'RESEAU' }), ['retard1']);
  assert.deepEqual(ids({ recherche: 'salle' }), ['loin']);
  assert.deepEqual(ids({ recherche: 'bob' }), ['bientot']);
  assert.deepEqual(ids({ recherche: '  ' }), ['TOUT']);
});

test('par membre : tous les exécutants comptent', () => {
  assert.deepEqual(ids({ membre: 'moi' }), ['bientot', 'retard1']);
  assert.deepEqual(ids({ membre: 'm:u2' }), ['bientot']);
  assert.deepEqual(ids({ membre: 'non' }), ['fait1', 'jalon', 'loin']);
});

test('par état, avec « normal » pour ceux sans état', () => {
  assert.deepEqual(ids({ etat: 'bloque' }), ['loin']);
  assert.deepEqual(ids({ etat: 'normal' }), ['fait1', 'jalon', 'retard1']);
});

test('par pilier, par période', () => {
  assert.deepEqual(ids({ pilier: 2 }), ['bientot', 'retard1']);
  assert.deepEqual(ids({ pilier: 1 }), ['bientot']);
  assert.deepEqual(ids({ periode: '7' }), ['bientot']);
  assert.deepEqual(ids({ periode: '30' }), ['bientot', 'jalon']);
  assert.deepEqual(ids({ periode: '90' }), ['bientot', 'jalon']);
});

test('les critères se cumulent', () => {
  assert.deepEqual(ids({ pilier: 2, statut: 'retard' }), ['retard1']);
  assert.deepEqual(ids({ pilier: 1, membre: 'm:u1' }), ['bientot']);
  assert.deepEqual(ids({ pilier: 1, statut: 'retard' }), []);
});

test('un résumé reste tant qu’une de ses sous-tâches passe', () => {
  const ts = [t('r', { titre: 'Phase 1' }), t('a', { parent: 'r', titre: 'Étape A' }), t('b', { parent: 'r', titre: 'Étape B', statut: 'fait' }), t('c', { titre: 'Seule' })];
  const pl = planifier(ts, projet, J);
  assert.deepEqual(ids({ statut: 'afaire' }, ts, pl), ['a', 'c', 'r']);
  assert.deepEqual(ids({ statut: 'faites' }, ts, pl), ['b', 'r']);
  assert.deepEqual(ids({ recherche: 'seule' }, ts, pl), ['c']);
});

test('compter les critères', () => {
  const c: Criteres = { ...CRITERES_VIDES, statut: 'retard', recherche: 'x', pilier: 3, periode: '30' };
  assert.equal(nbCriteres(c), 4);
  assert.equal(nbCriteresPlus(c), 2);
});

test('les piliers cités par les tâches', () => {
  assert.deepEqual(piliersDesTaches(taches), [1, 2]);
});
