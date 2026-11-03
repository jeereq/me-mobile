import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { TAILLES_TEXTE } from '../src/lib/taille-texte.ts';

const lire = (f: string) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');

describe('pages légales', () => {
  it('chargent toutes le style et la taille de texte', () => {
    for (const p of ['a-propos', 'cgv', 'conditions', 'confidentialite', 'mentions-legales']) {
      const html = lire(`${p}.html`);
      assert.ok(html.includes('href="/legal.css"'), p);
      assert.ok(html.includes('src="/legal.js"'), p);
    }
  });
  it('suivent les mêmes tailles que l’app', () => {
    const js = lire('legal.js');
    for (const t of TAILLES_TEXTE) {
      if (t.echelle === 1) continue;
      assert.match(js, new RegExp(`'?${t.cle}'?: ${t.echelle}`), t.cle);
    }
  });
});
