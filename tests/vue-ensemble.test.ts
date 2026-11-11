import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CRITERES_VIDES } from '../src/lib/filtres-taches.ts';
import { planifier } from '../src/lib/planning.ts';
import { adresseDe, brouillonMailResponsable, CRITERES_ENSEMBLE, vueEnsemble, responsablesEnsemble, type Entree } from '../src/lib/vue-ensemble.ts';
import type { Projet, Tache } from '../src/lib/types.ts';

const J = '2026-11-11';
const proj = (id: string, nom: string) => ({ id, nom, emoji: '📁', debut: null, joursOuvres: true, creeLe: J }) as Projet;
const t = (id: string, projet: string, x: Partial<Tache> = {}): Tache => ({ id, titre: id, source: 'manuel', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'passif', creeLe: J, projet, debut: '2026-11-12', duree: 2, fixe: true, ...x }) as Tache;
const membres = [
  { id: 'u1', nom: 'Alice Mbala', email: 'alice@x.cd', role: 'MEMBRE' as const, depuisLe: '2026-01-01' },
  { id: 'u2', nom: 'Bob Kasongo', email: 'bob@x.cd', role: 'MEMBRE' as const, depuisLe: '2026-01-01' },
];
const P1 = proj('p1', 'Cybersécurité');
const P2 = proj('p2', 'Site web');
const P3 = proj('p3', 'Vide');
const ts = [
  t('Audit', 'p1', { debut: '2026-11-02', duree: 3, affecteA: 'u1', responsable: 'Alice Mbala' }),
  t('Pare-feu', 'p1', { debut: '2026-11-16', duree: 3, affecteA: 'u2', executants: ['u2', 'u1'], responsable: 'Bob Kasongo, Alice Mbala' }),
  t('Maquette', 'p2', { debut: '2026-11-03', duree: 2, responsable: 'Paul Mbuyi' }),
  t('Contenu', 'p2', { debut: '2026-12-01', duree: 2 }),
  t('Fait', 'p2', { debut: '2026-10-01', duree: 1, statut: 'fait', responsable: 'Paul Mbuyi' }),
];
const entrees: Entree[] = [P1, P2, P3].map((projet) => {
  const taches = ts.filter((x) => x.projet === projet.id);
  return { projet, taches, plan: planifier(taches, projet, J) };
});
const ctx = { aujourdhui: J, membres };

test('par défaut, ce qui reste à faire ; les projets sans tâche correspondante disparaissent', () => {
  const e = vueEnsemble(entrees, CRITERES_ENSEMBLE, ctx);
  assert.deepEqual(e.groupes.map((g) => g.projet.id), ['p1', 'p2'], 'à retard égal, par nom');
  assert.equal(e.groupes.length, 2);
  assert.equal(e.nbTaches, 4);
  assert.equal(e.nbEnRetard, 2);
  assert.equal(e.comptes.toutes, 5);
  assert.equal(e.comptes.faites, 1);
  assert.equal(e.comptes.retard, 2);
});

test('sans critère, tout se montre, même un projet vide ; les retards passent en premier', () => {
  const e = vueEnsemble(entrees, CRITERES_VIDES, ctx);
  assert.equal(e.groupes.length, 3);
  assert.equal(e.nbTaches, 5);
  const p1 = e.groupes.find((g) => g.projet.id === 'p1')!;
  assert.deepEqual(p1.lignes.map((l) => l.tache.id), ['Audit', 'Pare-feu']);
});

test('un seul projet, ou un membre', () => {
  assert.equal(vueEnsemble(entrees, CRITERES_ENSEMBLE, { ...ctx, projetId: 'p1' }).groupes.length, 1);
  const e = vueEnsemble(entrees, { ...CRITERES_VIDES, membre: 'm:u2' }, ctx);
  assert.deepEqual(e.groupes.flatMap((g) => g.lignes.map((l) => l.tache.id)), ['Pare-feu']);
  const r = vueEnsemble(entrees, { ...CRITERES_VIDES, statut: 'retard' }, ctx);
  assert.deepEqual(r.groupes.flatMap((g) => g.lignes.map((l) => l.tache.id)).sort(), ['Audit', 'Maquette']);
});

test('les responsables : une tâche à plusieurs compte pour chacun, un nom libre reste, les tâches faites ne comptent pas', () => {
  const e = vueEnsemble(entrees, CRITERES_ENSEMBLE, ctx);
  const { responsables, sansResponsable } = responsablesEnsemble(e.groupes, membres, J);
  assert.equal(sansResponsable, 1);
  assert.deepEqual(responsables.map((r) => [r.nom, r.lignes.length, r.enRetard]), [['Alice Mbala', 2, 1], ['Paul Mbuyi', 1, 1], ['Bob Kasongo', 1, 0]]);
  assert.equal(responsables[1].membre, null);
});

test("l'adresse vient du membre, sinon des mails des comptes connectés", () => {
  const mails = [{ contact: 'Paul Mbuyi', adresse: 'Paul Mbuyi <paul@exemple.fr>' }];
  assert.equal(adresseDe({ nom: 'Alice Mbala', membre: membres[0] }, mails), 'alice@x.cd');
  assert.equal(adresseDe({ nom: 'Paul Mbuyi', membre: null }, mails), 'paul@exemple.fr');
  assert.equal(adresseDe({ nom: 'Zoé Inconnue', membre: null }, mails), null);
});

test('le brouillon liste les retards puis ce qui vient, avec projet et date', () => {
  const e = vueEnsemble(entrees, CRITERES_ENSEMBLE, ctx);
  const alice = responsablesEnsemble(e.groupes, membres, J).responsables[0];
  const b = brouillonMailResponsable(alice, { aujourdhui: J, adresse: 'alice@x.cd' });
  assert.equal(b.a, 'alice@x.cd');
  assert.equal(b.sujet, 'Tes tâches en retard (1)');
  assert.match(b.texte, /^Bonjour Alice,/);
  assert.match(b.texte, /En retard\n• Cybersécurité : Audit \(prévue le 04\/11\/2026\)/);
  assert.match(b.texte, /À faire\n• Cybersécurité : Pare-feu \(pour le 18\/11\/2026\)/);
  const sans = brouillonMailResponsable({ nom: 'Paul Mbuyi', lignes: [] }, { aujourdhui: J });
  assert.equal(sans.a, undefined);
  assert.equal(sans.nom, 'Paul Mbuyi');
});

test('un très long mail est raccourci', () => {
  const beaucoup = Array.from({ length: 40 }, (_, i) => ({ projet: P1, tache: t(`T${i}`, 'p1'), ligne: { fin: '2026-12-01', fait: false, jalon: false } as never }));
  const b = brouillonMailResponsable({ nom: 'Alice', lignes: beaucoup }, { aujourdhui: J });
  assert.equal(b.texte.split('\n').filter((l) => l.startsWith('• ')).length, 26);
  assert.match(b.texte, /… et 15 autres/);
});
