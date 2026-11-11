import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ajouterPlanIA, donneesProjet, lireEtat, lireJson, lirePlanIA, lireReponse, risquesProjet } from '../src/lib/ia-projet.ts';
import { planifier } from '../src/lib/planning.ts';
import type { Projet, Tache } from '../src/lib/types.ts';

const J = '2026-11-11';
const projet = { id: 'p', nom: 'Cybersécurité', emoji: '🛡️', debut: null, joursOuvres: true, creeLe: J } as Projet;
const t = (id: string, x: Partial<Tache> = {}): Tache => ({ id, titre: id, source: 'manuel', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'passif', creeLe: J, projet: 'p', debut: '2026-11-12', duree: 2, fixe: true, ...x }) as Tache;
const membres = [
  { id: 'u1', nom: 'Alice Mbala', email: 'a@x.cd', role: 'MEMBRE' as const, depuisLe: '2026-01-01' },
  { id: 'u2', nom: 'Bob', email: 'b@x.cd', role: 'MEMBRE' as const, depuisLe: '2026-01-01' },
];
const taches = [
  t('a', { titre: 'Audit réseau', debut: '2026-11-02', duree: 3, responsable: 'Alice Mbala' }),
  t('b', { titre: 'Pare-feu', debut: '2026-11-05', duree: 4, apres: ['a'], fixe: false }),
  t('c', { titre: 'Formation', debut: '2026-12-01', duree: 2, note: 'x'.repeat(500) }),
  t('d', { titre: 'Cahier des charges', debut: '2026-10-01', duree: 2, statut: 'fait' }),
];
const plan = planifier(taches, projet, J);
const ctx = { projet, taches, plan, aujourdhui: J, membres };

test('les données du projet sont compactes et signalent retards et liens', () => {
  const d = JSON.parse(donneesProjet(ctx));
  assert.equal(d.nom, 'Cybersécurité');
  assert.equal(d.aujourdhui, J);
  assert.deepEqual(d.membres, ['Alice Mbala', 'Bob']);
  const audit = d.taches.find((x: { titre: string }) => x.titre === 'Audit réseau');
  assert.equal(audit.enRetard, true);
  assert.equal(audit.responsable, 'Alice Mbala');
  assert.equal(d.taches.find((x: { titre: string }) => x.titre === 'Formation').note.length, 200);
  assert.equal(d.taches.at(-1).titre, 'Cahier des charges', 'les tâches faites viennent en dernier');
  const pare = d.taches.find((x: { titre: string }) => x.titre === 'Pare-feu');
  assert.deepEqual(pare.apres, ['Audit réseau']);
});

test('trop de tâches : la liste est raccourcie mais le total reste dit', () => {
  const beaucoup = Array.from({ length: 200 }, (_, i) => t(`t${i}`, { debut: '2026-11-12' }));
  const d = JSON.parse(donneesProjet({ ...ctx, taches: beaucoup, plan: planifier(beaucoup, projet, J) }));
  assert.equal(d.taches.length, 150);
  assert.equal(d.nbTaches, 200);
});

test("l'app repère seule les retards, du plus grave au moins grave", () => {
  const r = risquesProjet(ctx);
  assert.ok(r.length >= 1);
  const audit = r.find((x) => x.tache === 'Audit réseau');
  assert.ok(audit && /En retard de 7 jours/.test(audit.texte));
  assert.equal(risquesProjet({ ...ctx, taches: [t('z', { debut: '2026-12-01' })], plan: planifier([t('z', { debut: '2026-12-01' })], projet, J) }).length, 0);
  assert.equal(risquesProjet(ctx, 1).length, 1);
  const niveaux = r.map((x) => x.niveau);
  assert.deepEqual(niveaux, [...niveaux].sort((a, b) => (a === 'haut' ? 0 : 1) - (b === 'haut' ? 0 : 1)));
});

test('une tâche faite en retard ne fait pas un risque, une fin dépassée si', () => {
  const faites = [t('f', { titre: 'Fini', debut: '2026-10-01', statut: 'fait' })];
  assert.equal(risquesProjet({ ...ctx, taches: faites, plan: planifier(faites, projet, J) }).length, 0);
  const r = risquesProjet(ctx);
  assert.ok(r.some((x) => x.id === 'fin') === (plan.fin! < J));
});

test('lireJson accepte du JSON entouré de texte ou de ```', () => {
  assert.deepEqual(lireJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(lireJson('Voici : {"a":1} voilà'), { a: 1 });
  assert.equal(lireJson('rien'), null);
  assert.equal(lireJson('{pas du json}'), null);
  assert.equal(lireJson(''), null);
});

test("lireEtat garde l'essentiel et jette ce qui ne vaut rien", () => {
  const e = lireEtat(JSON.stringify({ resume: '  Le projet  avance. ', risques: [{ tache: 'Pare-feu', niveau: 'haut', pourquoi: 'Retard', action: 'Décaler' }, { tache: 'x' }, 'n’importe quoi'], actions: ['Relancer Bob', '', 3] }));
  assert.equal(e?.resume, 'Le projet avance.');
  assert.equal(e?.risques.length, 1);
  assert.equal(e?.risques[0].niveau, 'haut');
  assert.deepEqual(e?.actions, ['Relancer Bob']);
  assert.equal(lireEtat('{}'), null);
  assert.equal(lireEtat('pas du json'), null);
});

const brutPlan = JSON.stringify({
  taches: [
    { titre: 'Préparation', parent: null, duree: 1, apres: [], responsable: '', priorite: 'haute', jalon: false },
    { titre: 'Rédiger le cahier des charges', parent: 'Préparation', duree: 3, apres: [], responsable: 'alice mbala', priorite: 'haute' },
    { titre: 'Valider avec le client', parent: 'Préparation', duree: 2, apres: ['Rédiger le cahier des charges', 'Inconnue', 'Valider avec le client'], responsable: 'Zoé' },
    { titre: 'Rédiger le cahier des charges', parent: null, duree: 9 },
    { titre: 'Phase fantôme', parent: 'Pas encore', duree: 0 },
    { titre: 'Lancement', duree: 0, apres: ['Valider avec le client'] },
    { titre: '', duree: 4 },
  ],
});

test('lirePlanIA : pas de doublon, liens vers ce qui précède, durées entières', () => {
  const p = lirePlanIA(brutPlan);
  assert.deepEqual(p.map((x) => x.titre), ['Préparation', 'Rédiger le cahier des charges', 'Valider avec le client', 'Phase fantôme', 'Lancement']);
  assert.deepEqual(p[2].apres, ['Rédiger le cahier des charges']);
  assert.equal(p[3].parent, null, 'un parent qui ne précède pas est ignoré');
  assert.equal(p[3].jalon, true);
  assert.equal(p[4].jalon, true);
  assert.equal(p[1].priorite, 'haute');
  assert.equal(lirePlanIA('rien').length, 0);
});

test('ajouterPlanIA : phases, sous-tâches, liens et responsables du plan', () => {
  let n = 0;
  const avant = taches.length;
  const ts = ajouterPlanIA(taches, projet, lirePlanIA(brutPlan), { mode: 'passif', uid: () => `n${++n}`, membres });
  assert.equal(ts.length, avant + 5);
  const nouvelles = ts.slice(avant);
  const phase = nouvelles.find((x) => x.titre === 'Préparation')!;
  const redac = nouvelles.find((x) => x.titre === 'Rédiger le cahier des charges')!;
  const valider = nouvelles.find((x) => x.titre === 'Valider avec le client')!;
  assert.equal(redac.parent, phase.id);
  assert.equal(phase.duree, undefined, 'une phase tire ses dates de ses sous-tâches');
  assert.deepEqual(valider.apres, [redac.id]);
  assert.equal(redac.affecteA, 'u1');
  assert.equal(redac.responsable, 'Alice Mbala');
  assert.equal(valider.affecteA, undefined);
  assert.equal(valider.responsable, 'Zoé', 'un nom hors équipe reste écrit à la main');
  assert.equal(nouvelles.find((x) => x.titre === 'Lancement')?.jalon, true);
  assert.ok(nouvelles.every((x) => x.projet === 'p'));
  assert.equal(new Set(ts.map((x) => x.id)).size, ts.length);
});

test('lireReponse retire le markdown', () => {
  assert.equal(lireReponse('## Retards\n**Bob** est en retard.\n- Audit\n* Pare-feu'), 'Retards\nBob est en retard.\n• Audit\n• Pare-feu');
});
