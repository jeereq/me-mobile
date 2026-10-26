import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decoderTexte, lireFichier, lireTexte } from '../src/lib/tableur.ts';
import { lireXlsx } from '../src/lib/xlsx.ts';
import { fabriquerXlsx } from './aide-zip.ts';

describe('xlsx : lecture d’un classeur', () => {
  it('lit textes (partagés, en ligne, formules), nombres, booléens, erreurs et cellules vides', () => {
    const [f] = lireXlsx(
      fabriquerXlsx([
        {
          nom: 'Plan',
          lignes: [
            ['Tâche', 'Durée', 'Fait ?', 'Note'],
            ['Maquettes & tests <v1>', 5, true, { inline: 'texte "en ligne"' }],
            [null, null, false, { erreur: '#N/A' }],
            ['Vérifier', { formule: 'A1+1', v: 42 }, null, { formule: 'x', v: 'résultat' }],
            ['Accents é à ç – €', 2.5],
          ],
        },
      ]),
    );
    assert.equal(f.nom, 'Plan');
    assert.deepEqual(f.lignes[0], ['Tâche', 'Durée', 'Fait ?', 'Note']);
    assert.deepEqual(f.lignes[1], ['Maquettes & tests <v1>', 5, 'VRAI', 'texte "en ligne"']);
    assert.deepEqual(f.lignes[2], [null, null, 'FAUX', null]);
    assert.deepEqual(f.lignes[3], ['Vérifier', 42, null, 'résultat']);
    assert.deepEqual(f.lignes[4], ['Accents é à ç – €', 2.5]);
  });

  it('convertit les dates (formats intégrés, personnalisés, longs) et ignore les heures', () => {
    // 46000 = 2025-12-09 dans le calendrier 1900 d'Excel.
    const [f] = lireXlsx(fabriquerXlsx([{ nom: 'D', lignes: [[{ date: 46000 }, { date: 46000, style: 'perso' }, { date: 46000.75, style: 'long' }, { heure: 0.5 }, 46000]] }]));
    assert.deepEqual(f.lignes[0], ['2025-12-09', '2025-12-09', '2025-12-09', 0.5, 46000]);
  });

  it('gère le bogue de 1900 et le calendrier 1904', () => {
    const [a] = lireXlsx(fabriquerXlsx([{ nom: 'D', lignes: [[{ date: 61 }, { date: 59 }, { date: 1 }]] }]));
    assert.deepEqual(a.lignes[0], ['1900-03-01', '1900-02-28', '1900-01-01']);
    const [b] = lireXlsx(fabriquerXlsx([{ nom: 'D', lignes: [[{ date: 1462 }]] }], { systeme1904: true }));
    assert.deepEqual(b.lignes[0], ['1908-01-02']);
  });

  it('écrit les pourcentages et lit le retrait de chaque cellule', () => {
    const [f] = lireXlsx(fabriquerXlsx([{ nom: 'P', lignes: [[{ pct: 0.5 }, { pct: 0.125 }, { pct: 1 }], ['Lot', { texte: 'Étape', retrait: 1 }, { texte: 'Sous-étape', retrait: 2 }]] }]));
    assert.deepEqual(f.lignes[0], ['50 %', '12.5 %', '100 %']);
    assert.deepEqual(f.retraits![1], [0, 1, 2]);
    assert.deepEqual(f.lignes[1], ['Lot', 'Étape', 'Sous-étape']);
  });

  it('garde les lignes vides pour ne pas décaler les numéros de ligne, et retire les vides de la fin', () => {
    const [f] = lireXlsx(fabriquerXlsx([{ nom: 'V', lignes: [['a'], [], [], ['b'], [null, null]] }]));
    assert.equal(f.lignes.length, 4);
    assert.deepEqual(f.lignes[1], []);
    assert.deepEqual(f.lignes[3], ['b']);
  });

  it('saute les feuilles masquées, suit les cibles absolues, garde l’ordre des feuilles', () => {
    const octets = fabriquerXlsx(
      [
        { nom: 'Premier', lignes: [['1']] },
        { nom: 'Secret', lignes: [['2']], cachee: true },
        { nom: 'Troisième & dernier', lignes: [['3']] },
      ],
      { cibleAbsolue: true },
    );
    assert.deepEqual(lireXlsx(octets).map((f) => f.nom), ['Premier', 'Troisième & dernier']);
  });

  it('refuse un ZIP qui n’est pas un classeur, avec un message clair', () => {
    assert.throws(() => lireFichier(new Uint8Array([0x50, 0x4b, 5, 6, ...new Array(18).fill(0)]), 'x.xlsx'), /ZIP|archive|classeur/);
    assert.throws(() => lireFichier(Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0, 0), 'vieux.xls'), /\.xls/);
  });
});

describe('tableur : texte collé ou CSV', () => {
  it('détecte la tabulation d’un collage depuis Excel', () => {
    const f = lireTexte('Tâche\tDurée\nMaquettes\t5\nTests\t3\n');
    assert.deepEqual(f.lignes, [['Tâche', 'Durée'], ['Maquettes', '5'], ['Tests', '3']]);
  });
  it('détecte le point-virgule, la virgule, et respecte les guillemets', () => {
    assert.deepEqual(lireTexte('a;b;c\n1;"x;y";3').lignes, [['a', 'b', 'c'], ['1', 'x;y', '3']]);
    assert.deepEqual(lireTexte('a,b\n"un ""mot""","ligne\nsuivante"').lignes, [['a', 'b'], ['un "mot"', 'ligne\nsuivante']]);
  });
  it('garde les espaces de début de cellule (ils portent la hiérarchie) et vide les cellules blanches', () => {
    const f = lireTexte('Tâche;Durée\nLot;\n  Étape 1;2\n    Détail;1');
    assert.deepEqual(f.lignes, [['Tâche', 'Durée'], ['Lot', null], ['  Étape 1', '2'], ['    Détail', '1']]);
  });
  it('lit les fins de ligne Windows et ignore les lignes vides de la fin', () => {
    assert.deepEqual(lireTexte('a;b\r\n1;2\r\n\r\n\r\n').lignes, [['a', 'b'], ['1', '2']]);
  });
  it('décode UTF-8, UTF-16 et Windows-1252', () => {
    assert.equal(decoderTexte(new Uint8Array(Buffer.from('Élan – 12 €'))), 'Élan – 12 €');
    assert.equal(decoderTexte(new Uint8Array(Buffer.from('﻿Élan', 'utf16le'))), 'Élan');
    assert.equal(decoderTexte(Uint8Array.of(0xc9, 0x6c, 0x61, 0x6e, 0x20, 0x80)), 'Élan €');
  });
  it('lireFichier : un fichier texte donne une feuille nommée comme le fichier', () => {
    const [f] = lireFichier(new Uint8Array(Buffer.from('a;b\n1;2')), 'Mon plan.csv');
    assert.equal(f.nom, 'Mon plan');
    assert.deepEqual(f.lignes[1], ['1', '2']);
  });
});
