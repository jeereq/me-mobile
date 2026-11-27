import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chercherActions, etapesVisite, GUIDE, guideDeChemin, guideEnTexte, ORDRE_VISITE, type GuideCle } from '../src/lib/guide-pages.ts';
import { page } from '../src/lib/navigation.ts';

const CLES = Object.keys(GUIDE) as GuideCle[];

test('chaque page a un résumé, une visite et des actions avec des pas', () => {
  for (const cle of CLES) {
    const g = GUIDE[cle];
    assert.ok(g.resume.length > 10, `${cle} : résumé`);
    assert.ok(g.visite.length >= 2 && g.visite.length <= 5, `${cle} : visite de 2 à 5 points`);
    assert.ok(g.actions.length >= 2, `${cle} : actions`);
    for (const x of g.actions) {
      assert.ok(x.titre && x.groupe, `${cle}/${x.cle} : titre et groupe`);
      assert.ok(x.pas.length >= 1 && x.pas.every((p) => p.trim().length > 3), `${cle}/${x.cle} : pas`);
    }
  }
});

test('les clés d’action sont uniques dans une page', () => {
  for (const cle of CLES) {
    const cles = GUIDE[cle].actions.map((x) => x.cle);
    assert.equal(new Set(cles).size, cles.length, `${cle} : doublon`);
  }
});

test('la visite couvre les pages de l’ordre, dans l’ordre, avec un rang cohérent', () => {
  const e = etapesVisite();
  assert.deepEqual([...new Set(e.map((x) => x.cle))], [...ORDRE_VISITE]);
  for (const x of e) assert.ok(x.i >= 0 && x.i < x.n);
  assert.equal(etapesVisite(new Set(['finances'])).some((x) => x.cle === 'finances'), false);
});

test('chaque page de l’ordre de visite existe dans la navigation', () => {
  for (const cle of ORDRE_VISITE) assert.ok(page(cle).chemin.startsWith('/'));
});

test('guideDeChemin retrouve la page, sous-pages comprises', () => {
  assert.equal(guideDeChemin('/'), 'jour');
  assert.equal(guideDeChemin('/relances/'), 'relances');
  assert.equal(guideDeChemin('/annuaire/xyz'), 'annuaire');
  assert.equal(guideDeChemin('/inconnue'), null);
  for (const cle of CLES) if (cle !== 'annuaire') assert.equal(guideDeChemin(page(cle).chemin), cle, cle);
});

test('chercherActions ignore accents et majuscules, et demande tous les mots', () => {
  const toutes = GUIDE.taches.actions;
  assert.equal(chercherActions('taches', '  ').length, toutes.length);
  assert.equal(chercherActions('taches', 'zzzzqq').length, 0);
  const premier = toutes[0];
  const mot = premier.titre.split(/\s+/).find((m) => m.length > 3) ?? premier.titre;
  assert.ok(chercherActions('taches', mot.toUpperCase()).some((x) => x.cle === premier.cle));
});

test('guideEnTexte contient le résumé et les pas numérotés', () => {
  const t = guideEnTexte('relances');
  assert.ok(t.includes(GUIDE.relances.resume));
  assert.ok(t.includes('1. '));
});
