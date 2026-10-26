import assert from 'node:assert/strict';
import { test } from 'node:test';

import { changerPrincipal, convertirFinances, REFERENCE_USD, tauxEffectif, DEVISES, depuisPrincipal, fmtDevise, infoDevise, lireDevise, libelleOrigine, MOTIFS_DEVISES, saisie, versPrincipal } from '../src/lib/devises.ts';

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
  assert.equal(versPrincipal(10, 'XXX', '€', {}), null);
  assert.equal(versPrincipal(10, '$', '€', {}), 9.26); // taux de référence : 1 $ = 1/1,08 €
  assert.equal(versPrincipal(10, '$', '€', { $: 0 }), 9.26); // un taux invalide est ignoré
  assert.equal(versPrincipal(10, '€', 'FCFA', { '€': 655.957 }), 6560); // FCFA : pas de décimales
});

test('conversion inverse', () => {
  assert.equal(depuisPrincipal(9.2, '$', '€', { $: 0.92 }), 10);
  assert.equal(depuisPrincipal(5, 'XXX', '€', undefined), null);
  assert.equal(depuisPrincipal(1.08, '$', '€', {}), 1.17);
});

test('saisie : origine gardée seulement si la devise diffère', () => {
  assert.deepEqual(saisie(12, '€', '€', {}), { montant: 12 });
  assert.deepEqual(saisie(20, '$', '€', { $: 0.9 }), { montant: 18, origine: { montant: 20, devise: '$' } });
  assert.equal(saisie(20, 'XXX', '€', {}), null);
  assert.equal(saisie(20, '$', '€', {})?.origine?.devise, '$');
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
  assert.deepEqual(changerPrincipal('€', 'XXX', {}), {});
  assert.equal(changerPrincipal('€', '$', {})['€'], 1.08);
});

test('taux de référence : tous les libellés du catalogue en ont un, ton taux passe avant', () => {
  for (const d of DEVISES) assert.ok(REFERENCE_USD[d.cle] > 0, d.cle);
  assert.equal(tauxEffectif('$', '$', {}), 1);
  assert.equal(tauxEffectif('€', '$', {}), 1.08);
  assert.equal(tauxEffectif('€', '$', { '€': 1.1 }), 1.1);
  assert.equal(tauxEffectif('FCFA', 'FCFA', {}), 1);
  assert.ok(Math.abs(tauxEffectif('$', 'CDF', {})! - 1 / 0.00035) < 1e-6);
});

const fin = () => ({
  devise: '€',
  taux: { $: 0.9 },
  budgets: [{ id: 'b', montant: 100 }],
  depenses: [{ id: 'a', montant: 50 }, { id: 'c', montant: 9, origine: { montant: 10, devise: '$' } }],
  revenus: [{ id: 'r', montant: 2000 }],
  recurrences: [{ id: 'x', montant: 30 }],
});

test('convertirFinances : tout passe en dollars, les origines gardent la valeur d\'avant', () => {
  const g = convertirFinances(fin(), '$')!;
  assert.equal(g.devise, '$');
  // 1 $ = 0,9 € → 1 € = 1,1111… $
  assert.equal(g.budgets[0].montant, 111.11);
  assert.equal(g.depenses[0].montant, 55.56);
  assert.deepEqual(g.depenses[0].origine, { montant: 50, devise: '€' });
  // saisie d'origine en $ : le montant exact est retrouvé
  assert.equal(g.depenses[1].montant, 10);
  assert.equal(g.depenses[1].origine, undefined);
  assert.equal(g.revenus![0].montant, 2222.22);
  assert.equal(g.recurrences![0].montant, 33.33);
  assert.ok(Math.abs(g.taux!['€'] - 1 / 0.9) < 1e-6);
});

test('convertirFinances : aller-retour, les dépenses d\'origine reviennent exactes', () => {
  const retour = convertirFinances(convertirFinances(fin(), '$')!, '€')!;
  assert.equal(retour.devise, '€');
  assert.deepEqual(retour.depenses.map((x) => x.montant), [50, 9]);
  assert.equal(retour.depenses[0].origine, undefined); // saisie en € à l'origine : plus rien à garder
  assert.equal(retour.depenses[1].origine?.devise, '$');
  assert.equal(retour.revenus![0].montant, 2000);
  assert.equal(retour.budgets[0].montant, 100);
});

test('convertirFinances : devise inconnue → null, même devise → inchangé', () => {
  assert.equal(convertirFinances(fin(), 'XXX'), null);
  const f = fin();
  assert.equal(convertirFinances(f, '€'), f);
});

test('convertirFinances : FCFA sans décimales', () => {
  const g = convertirFinances({ devise: '$', budgets: [{ montant: 10 }], depenses: [{ montant: 1.5 }] }, 'FCFA')!;
  assert.equal(g.budgets[0].montant, Math.round(10 / 0.00165));
  assert.ok(Number.isInteger(g.depenses[0].montant));
});
