import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lireJson } from '../src/lib/json-sur';

test('lit une valeur gardée', () => {
  assert.deepEqual(lireJson('{"a":1}'), { a: 1 });
});

test('une valeur abîmée ou absente compte comme absente', () => {
  assert.equal(lireJson('{oups'), null);
  assert.equal(lireJson(''), null);
  assert.equal(lireJson(null), null);
  assert.equal(lireJson(undefined), null);
});
