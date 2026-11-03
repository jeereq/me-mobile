import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chercherPays, commeNumero, composer, drapeau, numeroPlausible, PAYS, paysDe, PAYS_DEFAUT, separer } from '../src/lib/indicatifs.ts';

const pays = (iso: string) => PAYS.find((p) => p.iso === iso)!;

describe('indicatifs', () => {
  it('met la RD Congo d’abord, sans doublon', () => {
    assert.equal(PAYS[0].code, '243');
    assert.equal(new Set(PAYS.map((p) => p.iso)).size, PAYS.length);
    assert.ok(PAYS.length > 200);
    for (const p of PAYS) assert.match(p.code, /^\d{1,4}$/);
  });
  it('compose le numéro complet', () => {
    assert.equal(composer(PAYS_DEFAUT, '81 234 5678'), '+243812345678');
    assert.equal(composer(PAYS_DEFAUT, '0812345678'), '+243812345678');
    assert.equal(composer(PAYS_DEFAUT, '243 81 234 5678'), '+243812345678');
    assert.equal(composer(pays('FR'), '06 12 34 56 78'), '+33612345678');
    assert.equal(composer(pays('IT'), '06 123 4567'), '+39061234567');
    assert.equal(composer(PAYS_DEFAUT, '  '), '');
  });
  it('ne confond pas un numéro qui commence comme l’indicatif', () => {
    assert.equal(composer(pays('IN'), '91 1234 5678'), '+919112345678');
  });
  it('reconnaît un indicatif collé', () => {
    assert.deepEqual(separer('+33 6 12 34 56 78'), { pays: pays('FR'), national: '612345678' });
    assert.equal(separer('00225 07 00 00 00')?.pays.iso, 'CI');
    assert.equal(separer('+1268 555 1234')?.pays.iso, 'AG');
    assert.equal(separer('+1 415 555 1234')?.pays.code, '1');
    assert.equal(separer('0812345678'), null);
    assert.equal(separer('+999999'), null);
  });
  it('contrôle la longueur', () => {
    assert.equal(numeroPlausible(PAYS_DEFAUT, '0812345678'), true);
    assert.equal(numeroPlausible(PAYS_DEFAUT, '81234'), false);
    assert.equal(numeroPlausible(pays('DK'), '12 34 56 78'), true);
    assert.equal(numeroPlausible(pays('FR'), '123'), false);
    assert.equal(numeroPlausible(pays('FR'), '1234567890123456'), false);
  });
  it('cherche par nom, sans accent, ou par indicatif', () => {
    assert.ok(chercherPays('senegal').some((p) => p.iso === 'SN'));
    assert.equal(chercherPays('+243')[0].iso, 'CD');
    assert.equal(chercherPays('').length, PAYS.length);
  });
  it('garde la RD Congo, plus les pays ouverts', () => {
    assert.deepEqual(paysDe(['243']).map((p) => p.iso), ['CD']);
    assert.deepEqual(paysDe([]).map((p) => p.iso), ['CD']);
    assert.deepEqual(paysDe(['243', '33']).map((p) => p.iso), ['CD', 'FR']);
    assert.deepEqual(chercherPays('fr', paysDe(['243', '33'])).map((p) => p.iso), ['FR']);
  });
  it('dessine le drapeau', () => {
    assert.equal(drapeau('CD'), '🇨🇩');
  });
  it('repère un début de numéro', () => {
    assert.equal(commeNumero('081 234'), true);
    assert.equal(commeNumero('+243'), false);
    assert.equal(commeNumero('jean'), false);
  });
});
