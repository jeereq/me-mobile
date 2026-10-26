import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deflateRawSync } from 'node:zlib';

import { inflate } from '../src/lib/inflate.ts';
import { lireZip, utf8 } from '../src/lib/zip.ts';
import { fabriquerZip } from './aide-zip.ts';

// Générateur pseudo-aléatoire fixe : les tests ne dépendent pas du hasard.
function alea(graine: number) {
  let s = graine >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('inflate : même résultat que zlib', () => {
  const r = alea(42);
  const aleatoire = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(r() * 256));
  const texte = (n: number) => Buffer.from(Array.from({ length: n }, (_, i) => `<row r="${i}"><c r="A${i}" t="s"><v>${i % 97}</v></c></row>`).join(''));
  const cas: [string, Uint8Array][] = [
    ['vide', new Uint8Array(0)],
    ['un octet', Uint8Array.of(65)],
    ['court (codes fixes)', Buffer.from('Bonjour Bonjour Bonjour')],
    ['texte répétitif', texte(3000)],
    ['octets aléatoires', aleatoire(5000)],
    ['même octet 100 000 fois', new Uint8Array(100000).fill(7)],
    ['mélange texte et bruit', Buffer.concat([texte(500), Buffer.from(aleatoire(2000)), texte(500)])],
    ['plus de 64 Ko', Buffer.from(texte(9000))],
  ];
  for (const [nom, donnees] of cas)
    for (const niveau of [0, 1, 6, 9])
      it(`${nom}, niveau ${niveau}`, () => {
        const comp = deflateRawSync(donnees, { level: niveau });
        assert.deepEqual(Buffer.from(inflate(new Uint8Array(comp), donnees.length)), Buffer.from(donnees));
        assert.deepEqual(Buffer.from(inflate(new Uint8Array(comp))), Buffer.from(donnees), 'sans connaître la taille d’avance');
      });

  it('refuse un flux tronqué ou corrompu sans boucler', () => {
    const comp = deflateRawSync(Buffer.from(texte(500)));
    assert.throws(() => inflate(new Uint8Array(comp.subarray(0, comp.length - 10))), /tronqué|invalide/);
    assert.throws(() => inflate(Uint8Array.of(0xff, 0xff, 0xff)), /tronqué|invalide/);
  });
});

describe('zip', () => {
  it('lit les fichiers compressés et stockés, avec des noms accentués et un commentaire d’archive', () => {
    const fichiers = { 'a.txt': 'bonjour', 'dossier/é à.xml': '<x>€ 😀</x>', 'vide.txt': '' };
    for (const opts of [{}, { stocke: true }, { commentaire: 'créé par un test' }]) {
      const z = lireZip(fabriquerZip(fichiers, opts));
      assert.deepEqual(z.noms.sort(), Object.keys(fichiers).sort());
      assert.equal(z.texte('a.txt'), 'bonjour');
      assert.equal(z.texte('dossier/é à.xml'), '<x>€ 😀</x>');
      assert.equal(z.texte('vide.txt'), '');
      assert.equal(z.texte('absent.txt'), null);
    }
  });

  it('refuse un fichier qui n’est pas une archive', () => {
    assert.throws(() => lireZip(new Uint8Array(Buffer.from('juste du texte, pas un zip'))), /pas une archive/);
    assert.throws(() => lireZip(new Uint8Array(0)), /pas une archive/);
  });

  it('décode l’UTF-8 : accents, euro, émoji (paire de substitution), BOM', () => {
    const t = 'Éléments à vérifier – 12 € – 😀';
    assert.equal(utf8(new Uint8Array(Buffer.from(t))), t);
    assert.equal(utf8(new Uint8Array(Buffer.from('﻿abc'))), 'abc');
    assert.equal(utf8(new Uint8Array(Buffer.from('x'.repeat(20000)))).length, 20000);
  });
});
