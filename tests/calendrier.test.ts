import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decalerMois, grilleMois } from '../src/lib/dates.ts';

test('calendrier : le mois commence le bon jour de la semaine (lundi en premier)', () => {
  // Le 1er octobre 2026 est un jeudi : trois cases vides avant.
  const g = grilleMois('2026-10');
  assert.deepEqual(g.slice(0, 4), [null, null, null, '2026-10-01']);
  assert.equal(g.length % 7, 0);
  assert.equal(g.filter(Boolean).length, 31);
  assert.equal(g.filter(Boolean).at(-1), '2026-10-31');
});

test('calendrier : février, et un mois qui commence un lundi', () => {
  assert.equal(grilleMois('2028-02').filter(Boolean).length, 29);
  assert.equal(grilleMois('2026-06')[0], '2026-06-01');
});

test('calendrier : mois précédent et suivant, à cheval sur les années', () => {
  assert.equal(decalerMois('2026-12', 1), '2027-01');
  assert.equal(decalerMois('2026-01', -1), '2025-12');
});
