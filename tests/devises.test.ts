import assert from 'node:assert/strict';
import { test } from 'node:test';

import { changerPrincipal, DEVISES, depuisPrincipal, fmtDevise, infoDevise, lireDevise, libelleOrigine, MOTIFS_DEVISES, saisie, versPrincipal } from '../src/lib/devises.ts';

test('les clés du catalogue sont uniques et les anciens libellés restent valides', () => {
  assert.equal(new Set(DEVISES.map((d) => d.cle)).size, DEVISES.length);
  for (const k of ['€', '$', 'FCFA', '£', 'CHF']) assert.ok(DEVISES.some((d) => d.cle === k));
});

test('lireDevise reconnaît symboles, codes et noms', () => {
  assert.equal(lireDevise('USD'), '$');
  assert.equal(lireDevise('dollars'), '$');
  assert.equal(lireDevise('xof'), 'FCFA');
  assert.equal(lireDevise('€'), '€');
  assert.equal(lireDevise('yen'), 'JPY');
  assert.equal(lireDevise('bidule'), null);
});

test('MOTIFS_DEVISES : les plus longs d\'abord, symboles échappés', () => {
  const re = new RegExp(`^(${MOTIFS_DEVISES})$`, 'i');
  for (const m of ['€', '$', '£', 'fcfa', 'euros', 'dollars', 'CAD']) assert.ok(re.test(m), m);
  assert.equal(new RegExp(`^(${MOTIFS_DEVISES})$`, 'i').test('euro'), true);
});

test('conversion vers la devise principale, arrondie selon ses décimales', () => {
  assert.equal(versPrincipal(10, '€', '€', {}), 10);
  assert.equal(versPrincipal(10, '$', '€', { $: 0.92 }), 9.2);
  assert.equal(versPrincipal(10, '$', '€', {}), null);
  assert.equal(versPrincipal(10, '$', '€', { $: 0 }), null);
  assert.equal(versPrincipal(10, '€', 'FCFA', { '€': 655.957 }), 6560); // FCFA : pas de décimales
});

test('conversion inverse', () => {
  assert.equal(depuisPrincipal(9.2, '$', '€', { $: 0.92 }), 10);
  assert.equal(depuisPrincipal(5, '$', '€', undefined), null);
});

test('saisie : origine gardée seulement si la devise diffère', () => {
  assert.deepEqual(saisie(12, '€', '€', {}), { montant: 12 });
  assert.deepEqual(saisie(20, '$', '€', { $: 0.9 }), { montant: 18, origine: { montant: 20, devise: '$' } });
  assert.equal(saisie(20, '$', '€', {}), null);
});

test('fmtDevise : décimales selon la devise', () => {
  assert.match(fmtDevise(1200, '€'), /^1\s?200 €$/);
  assert.match(fmtDevise(12.5, '$'), /^12,50 \$$/);
  assert.match(fmtDevise(3000.4, 'FCFA'), /FCFA$/);
  assert.ok(!fmtDevise(3000.4, 'FCFA').includes(','));
  assert.equal(infoDevise('inconnue').decimales, 2);
});

test('libelleOrigine', () => {
  assert.equal(libelleOrigine(undefined, '€'), null);
  assert.equal(libelleOrigine({ montant: 20, devise: '€' }, '€'), null);
  assert.match(libelleOrigine({ montant: 20, devise: '$' }, '€')!, /^20 \$$/);
});

test('changerPrincipal inverse les taux', () => {
  const t = changerPrincipal('€', '$', { $: 0.5, FCFA: 0.0015 });
  assert.equal(t['€'], 2);
  assert.equal(t.FCFA, 0.003);
  assert.equal('$' in t, false);
  assert.deepEqual(changerPrincipal('€', '$', {}), {});
});
