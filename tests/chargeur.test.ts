import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const fichiers = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? fichiers(join(d, n)) : /\.tsx$/.test(n) ? [join(d, n)] : []));

test('un seul indicateur de chargement dans l’app', () => {
  assert.deepEqual(fichiers('src').filter((f) => readFileSync(f, 'utf8').includes('<ActivityIndicator')), []);
});
