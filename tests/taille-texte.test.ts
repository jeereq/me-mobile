import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { echelleDe, lireTaille, tailleAjustee, TAILLES_TEXTE } from '../src/lib/taille-texte.ts';

describe('taille du texte', () => {
  it('propose de réduire et d’agrandir, le normal ne change rien', () => {
    assert.ok(echelleDe('petit', true) < 1);
    assert.equal(echelleDe('normal', true), 1);
    assert.ok(echelleDe('tres-grand', true) > echelleDe('grand', true));
    assert.deepEqual(tailleAjustee({ fontSize: 14, lineHeight: 20 }, 1), {});
  });
  it('ne change rien sur une vue d’ordinateur', () => {
    for (const t of TAILLES_TEXTE) assert.equal(echelleDe(t.cle, false), 1);
  });
  it('revient au normal sur une valeur inconnue', () => {
    assert.equal(lireTaille('grand'), 'grand');
    assert.equal(lireTaille('enorme'), 'normal');
    assert.equal(lireTaille(null), 'normal');
  });
  it('ajuste la taille et l’interligne, sans toucher à un texte qui hérite', () => {
    assert.deepEqual(tailleAjustee({ fontSize: 10, lineHeight: 20 }, 1.3), { fontSize: 13, lineHeight: 26 });
    assert.deepEqual(tailleAjustee({ fontSize: 13 }, 1.15), { fontSize: 15 });
    assert.deepEqual(tailleAjustee({ lineHeight: 20 }, 1.3), { lineHeight: 26 });
    assert.deepEqual(tailleAjustee({}, 1.3), {});
    assert.deepEqual(tailleAjustee(undefined, 1.3), {});
  });
  it('tous les textes de l’app passent par le composant qui suit le réglage', () => {
    const fichiers = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? fichiers(join(d, n)) : [join(d, n)]));
    const fautifs = fichiers('src').filter((f) => /\.tsx?$/.test(f) && !f.endsWith('components/texte.tsx')).filter((f) => {
      const m = readFileSync(f, 'utf8').match(/import\s*\{([^}]*)\}\s*from 'react-native';/);
      return m?.[1].split(',').some((x) => ['Text', 'TextInput'].includes(x.trim()));
    });
    assert.deepEqual(fautifs, []);
  });
});
