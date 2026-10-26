import { lireXlsx } from './xlsx';
import { utf8 } from './zip';

/**
 * Un tableau lu dans un fichier : classeur Excel (.xlsx), CSV ou texte collé depuis Excel (colonnes séparées par des tabulations).
 * Les cellules sont du texte ou des nombres ; les dates Excel sont déjà converties en « AAAA-MM-JJ ».
 *
 * Ce fichier n'importe que des fichiers purs : il se teste avec `npm test`.
 */

export type Cellule = string | number | null;
export type Feuille = {
  nom: string;
  lignes: Cellule[][];
  /** Retrait (indentation) de chaque cellule quand le classeur en donne : c'est ainsi qu'un plan Excel montre ses sous-tâches. */
  retraits?: number[][];
};

const CP1252: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

/** Texte d'un fichier : UTF-8, UTF-16 (« Texte Unicode » d'Excel) ou, à défaut, Windows-1252 comme les exports des banques françaises. */
export function decoderTexte(b: Uint8Array): string {
  if ((b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff)) {
    const petit = b[0] === 0xff;
    let t = '';
    for (let i = 2; i + 1 < b.length; i += 2) t += String.fromCharCode(petit ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]);
    return t;
  }
  const t = utf8(b);
  if (!t.includes('�')) return t;
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i] >= 0x80 && b[i] < 0xa0 ? (CP1252[b[i]] ?? '') : String.fromCharCode(b[i]);
  return s;
}

/** Découpe un texte CSV/TSV en lignes de cellules ; guillemets doublés et retours à la ligne entre guillemets acceptés. */
function decouper(texte: string, sep: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = '';
  let guillemets = false;
  const fin = () => {
    ligne.push(cellule);
    cellule = '';
  };
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          cellule += '"';
          i++;
        } else guillemets = false;
      } else cellule += c;
    } else if (c === '"' && cellule.trim() === '') {
      cellule = '';
      guillemets = true;
    } else if (c === sep) fin();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      fin();
      lignes.push(ligne);
      ligne = [];
    } else cellule += c;
  }
  if (cellule !== '' || ligne.length) {
    fin();
    lignes.push(ligne);
  }
  return lignes;
}

/** Le séparateur le plus constant sur les premières lignes : tabulation (collage depuis Excel), point-virgule, virgule ou barre. */
function separateur(texte: string): string {
  const echantillon = texte.split(/\r\n|\n|\r/).filter((l) => l.trim()).slice(0, 12);
  let meilleur = ',';
  let score = 0;
  for (const sep of ['\t', ';', ',', '|']) {
    // Les lignes qui contiennent le séparateur (un titre au-dessus du tableau n'en a pas), puis leur régularité ; à égalité, l'ordre
    // de la liste départage (la tabulation d'abord).
    const nb = echantillon.map((l) => decouper(l, sep)[0]?.length ?? 0).filter((x) => x > 1);
    if (nb.length * 2 < echantillon.length || !nb.length) continue;
    const s = nb.length * 1e6 + Math.min(...nb) * 1000 + Math.max(...nb);
    if (s > score) {
      score = s;
      meilleur = sep;
    }
  }
  return meilleur;
}

export function lireTexte(texte: string, nom = 'Feuille 1'): Feuille {
  const brut = texte.replace(/^﻿/, '');
  const sep = separateur(brut);
  const lignes = decouper(brut, sep).map((l) => l.map((c) => (c.trim() === '' ? null : c)));
  while (lignes.length && lignes[lignes.length - 1].every((c) => c === null)) lignes.pop();
  return { nom, lignes };
}

/** Lit un fichier choisi par l'utilisateur : classeur .xlsx ou texte (CSV, TSV). */
export function lireFichier(octets: Uint8Array, nomFichier = ''): Feuille[] {
  if (octets[0] === 0x50 && octets[1] === 0x4b) return lireXlsx(octets);
  if (octets[0] === 0xd0 && octets[1] === 0xcf && octets[2] === 0x11 && octets[3] === 0xe0)
    throw new Error("Ce fichier est un ancien classeur Excel (.xls), que Me ne sait pas lire. Enregistre-le au format .xlsx (Fichier › Enregistrer sous), ou en CSV, puis recommence.");
  const nom = nomFichier.replace(/\.[^.]+$/, '') || 'Feuille 1';
  return [lireTexte(decoderTexte(octets), nom)];
}
