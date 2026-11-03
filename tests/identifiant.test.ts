import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emailDouteux, identifiantDouteux } from '../src/lib/identifiant.ts';

describe('identifiant de connexion', () => {
  it('accepte un email ou un numéro complet', () => {
    for (const x of ['a@x.com', '0817125577', '+243 817 125 577', '243-817-125-577', ' 0817125577 ']) assert.equal(identifiantDouteux(x), false, x);
  });
  it('signale ce qui n’est ni l’un ni l’autre', () => {
    for (const x of ['a@x', 'bonjour', '08171', 'abc817125577']) assert.equal(identifiantDouteux(x), true, x);
  });
  it('ne dit rien tant que le champ est vide', () => {
    assert.equal(identifiantDouteux('  '), false);
  });
  it('l’inscription reste sur un email', () => {
    assert.equal(emailDouteux('0817125577'), true);
  });
});
