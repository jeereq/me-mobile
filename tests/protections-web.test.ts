import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const lire = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

describe('protections du site web', () => {
  const entetes = (JSON.parse(lire('vercel.json')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }).headers.find((h) => h.source === '/(.*)')?.headers ?? [];
  const valeur = (cle: string) => entetes.find((e) => e.key === cle)?.value ?? '';

  it('refuse les scripts écrits dans la page et les iframes', () => {
    const csp = valeur('Content-Security-Policy');
    assert.match(csp, /script-src 'self';/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(valeur('X-Frame-Options'), 'DENY');
  });
  it('la page d’accueil ne contient plus de script écrit dans la page', () => {
    const scripts = lire('public/index.html').match(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/g) ?? [];
    assert.deepEqual(scripts, []);
    assert.doesNotMatch(lire('public/index.html'), /\son[a-z]+="/);
  });
  it('le serveur et les deux hébergeurs annoncent la même politique', () => {
    assert.ok(lire('render.yaml').includes(valeur('Content-Security-Policy')));
  });
});
