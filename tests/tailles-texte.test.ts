import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/** L'échelle du texte : petit, courant, lecture, sous-titre, titre, grand titre, et les très grands chiffres. */
const ECHELLE = new Set([12, 13, 15, 17, 20, 24, 28, 34, 40, 44, 48, 56]);

const fichiers = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? fichiers(join(d, f)) : /\.tsx?$/.test(f) ? [join(d, f)] : []));

test('les tailles de texte écrites en dur suivent l’échelle (12, 13, 15, 17, 20, 24, 28, 34…)', () => {
  const hors: string[] = [];
  for (const f of fichiers('src'))
    readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      for (const m of l.matchAll(/fontSize: *([^,}]*)/g)) for (const n of m[1].matchAll(/(?:^|\? |: )(\d+(?:\.\d+)?)(?![\d.])/g)) if (!ECHELLE.has(Number(n[1]))) hors.push(`${f}:${i + 1} ${n[1]}`);
    });
  assert.deepEqual(hors, []);
});
