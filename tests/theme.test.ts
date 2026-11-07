import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const fichiers = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? fichiers(join(d, n)) : /\.tsx?$/.test(n) ? [join(d, n)] : []));
const COULEUR = /\bC\.(bg|surface|sunk|ink|muted|line|accent\w*|glow|halo|tabBg|passif|normal|agressif|coach|hebdo|sombre)\b/;

/**
 * Les couleurs de C changent quand le thème change, mais une table écrite au chargement du fichier
 * garde celles du thème par défaut. Une couleur se lit dans un composant ou dans une fonction.
 */
test('aucune couleur du thème copiée au chargement d’un fichier', () => {
  const figees: string[] = [];
  for (const f of fichiers('src')) {
    if (f.endsWith(join('lib', 'theme.ts'))) continue;
    const lignes = readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < lignes.length; i++) {
      const debut = /^(?:export )?(?:const|let) (\w+)(?::[^=]+)? = (.*)$/.exec(lignes[i]);
      if (!debut || /^(?:\(|async\b|function\b|<)/.test(debut[2]) || /^[\w\s,]+=>/.test(debut[2])) continue;
      let bloc = lignes[i];
      let prof = (bloc.match(/[{[(]/g) ?? []).length - (bloc.match(/[}\])]/g) ?? []).length;
      let j = i;
      while (prof > 0 && j + 1 < lignes.length) {
        j++;
        bloc += `\n${lignes[j]}`;
        prof += (lignes[j].match(/[{[(]/g) ?? []).length - (lignes[j].match(/[}\])]/g) ?? []).length;
      }
      // Les fonctions fléchées gardent la lecture à l'appel : seules les valeurs directes posent problème.
      const direct = bloc.replace(/\([^()]*\)\s*=>[^,}\n]*/g, '');
      if (COULEUR.test(direct)) figees.push(`${f}:${i + 1} ${debut[1]}`);
      i = j;
    }
  }
  assert.deepEqual(figees, []);
});
