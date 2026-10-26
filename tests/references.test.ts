import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cleReference, numeroter, reperer } from '../src/lib/references.ts';

describe('cleReference', () => {
  it('combine référence, date, sens, montant et libellé', () => {
    assert.equal(cleReference('S476646', '2024-10-29', 'depense', 400, 'Retrait ATM/430312561666/122549'), 'S476646|2024-10-29|d|400.00|retrait atm/430312561666/122549');
  });
  it('distingue le retrait, ses frais et sa TVA, qui partagent la même référence', () => {
    const cles = [
      cleReference('S476646', '2024-10-29', 'depense', 400, 'Retrait ATM/1/2'),
      cleReference('S476646', '2024-10-29', 'depense', 3, 'Frais sur Retrait ATM/2'),
      cleReference('S476646', '2024-10-29', 'depense', 0.48, 'TVA sur Retrait ATM/2'),
    ];
    assert.equal(new Set(cles).size, 3);
  });
  it('ignore la casse, les accents et les espaces du libellé', () => {
    assert.equal(cleReference('R1', '2025-01-01', 'revenu', 5, '  Café   DU coin '), cleReference('R1', '2025-01-01', 'revenu', 5, 'cafe du coin'));
  });
  it('sans référence : null', () => {
    assert.equal(cleReference('', '2025-01-01', 'depense', 5, 'x'), null);
    assert.equal(cleReference('  ', '2025-01-01', 'depense', 5, 'x'), null);
    assert.equal(cleReference(null, '2025-01-01', 'depense', 5, 'x'), null);
  });
});

describe('numeroter', () => {
  it('numérote les lignes strictement identiques d’un même fichier', () => {
    assert.deepEqual(numeroter(['a', 'b', 'a', null, 'a', null]), ['a', 'b', 'a#2', null, 'a#3', null]);
  });
  it('donne les mêmes clés quand on réimporte le même fichier', () => {
    const f = ['a', 'a', 'b'];
    assert.deepEqual(numeroter(f), numeroter([...f]));
  });
});

describe('reperer', () => {
  const ligne = (reference: string | null, ancienne: string) => ({ reference, ancienne });
  it('repère une référence déjà enregistrée', () => {
    assert.deepEqual(reperer([ligne('A', 'x'), ligne('B', 'y')], new Set(['A']), []), [true, false]);
  });
  it('une référence nouvelle n’est pas un doublon, même si date et montant ressemblent à une autre opération avec référence', () => {
    assert.deepEqual(reperer([ligne('B', 'd:2025-01-01:5')], new Set(['A']), []), [false]);
  });
  it('compare date et montant aux opérations notées sans référence, une ligne par opération', () => {
    const r = reperer([ligne(null, 'd:2025-01-01:5'), ligne(null, 'd:2025-01-01:5'), ligne(null, 'd:2025-01-01:5')], new Set(), ['d:2025-01-01:5', 'd:2025-01-01:5']);
    assert.deepEqual(r, [true, true, false]);
  });
  it('une ligne avec référence peut aussi correspondre à un ancien import sans référence', () => {
    assert.deepEqual(reperer([ligne('Z', 'd:2025-01-01:5')], new Set(), ['d:2025-01-01:5']), [true]);
  });
  it('sans rien d’enregistré : aucun doublon', () => {
    assert.deepEqual(reperer([ligne('A', 'x'), ligne(null, 'y')], new Set(), []), [false, false]);
  });
});
