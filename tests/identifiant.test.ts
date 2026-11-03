import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emailDouteux } from '../src/lib/identifiant.ts';

describe('email saisi', () => {
  it('accepte une adresse complète', () => {
    assert.equal(emailDouteux('a@x.com'), false);
    assert.equal(emailDouteux('  '), false);
  });
  it('signale le reste', () => {
    for (const x of ['a@x', 'bonjour', '0817125577']) assert.equal(emailDouteux(x), true, x);
  });
});
