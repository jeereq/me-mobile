import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const fichiers = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? fichiers(join(d, f)) : /\.tsx?$/.test(f) ? [join(d, f)] : []));

test('les tailles de texte sont des pixels entiers (échelle : 10, 11, 12, 13, 14, 15, 16…)', () => {
  const demis = fichiers('src').flatMap((f) => readFileSync(f, 'utf8').split('\n').flatMap((l, i) => (/fontSize: *\d+\.\d+/.test(l) ? [`${f}:${i + 1}`] : [])));
  assert.deepEqual(demis, []);
});
