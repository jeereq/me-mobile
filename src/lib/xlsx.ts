import type { Cellule, Feuille } from './tableur';
import { lireZip } from './zip';

/**
 * Lecture d'un classeur Excel (.xlsx) : feuilles visibles, valeurs des cellules (les formules donnent leur dernier résultat),
 * dates converties en « AAAA-MM-JJ », pourcentages écrits « 50 % », retrait de chaque cellule.
 * Un .xlsx est une archive ZIP de fichiers XML ; on n'en lit que ce qu'il faut, sans analyseur XML.
 *
 * Ce fichier n'importe que des fichiers purs : il se teste avec `npm test`.
 */

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decoder = (s: string) =>
  s
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
      }
      return ENTITES[e.toLowerCase()] ?? m;
    })
    // Excel écrit les caractères de contrôle ainsi : « _x000D_ ».
    .replace(/_x([0-9a-f]{4})_/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));

const attribut = (balise: string, nom: string): string | null => {
  const m = new RegExp(`(?:^|\\s)${nom.replace(':', '\\:')}\\s*=\\s*"([^"]*)"`).exec(balise);
  return m ? decoder(m[1]) : null;
};

/** Texte d'un élément `<si>` ou `<is>` : toutes ses portions `<t>`, sans les annotations phonétiques. */
function texteDe(xml: string): string {
  const net = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let t = '';
  for (const m of net.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)) t += m[1] ?? '';
  return decoder(t);
}

// Formats de date intégrés : 14-17 (dates), 22 (date et heure), 27-31 et 34-36 (calendriers asiatiques), 50-58 (selon la langue).
const DATES_INTEGREES = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

function estFormatDate(code: string): boolean {
  const net = code.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[[^\]]*\]/g, '').replace(/_./g, '').replace(/\*./g, '').replace(/general/gi, '');
  // « m » seul est ambigu (minutes) : il faut un jour ou une année pour que ce soit une date.
  return /[dyg]/i.test(net);
}

type Style = { date: boolean; pourcent: boolean; retrait: number };

function lireStyles(xml: string | null): Style[] {
  if (!xml) return [];
  const codes = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt\b([^>]*?)\/?>/g)) {
    const id = attribut(m[1], 'numFmtId');
    const code = attribut(m[1], 'formatCode');
    if (id !== null && code !== null) codes.set(Number(id), code);
  }
  const bloc = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  if (!bloc) return [];
  const styles: Style[] = [];
  for (const m of bloc[1].matchAll(/<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g)) {
    const id = Number(attribut(m[1], 'numFmtId') ?? 0);
    const code = codes.get(id);
    const alignement = m[2] ? /<alignment\b([^>]*?)\/?>/.exec(m[2]) : null;
    styles.push({
      date: code !== undefined ? estFormatDate(code) : DATES_INTEGREES.has(id),
      pourcent: id === 9 || id === 10 || (code !== undefined && code.includes('%')),
      retrait: alignement ? Number(attribut(alignement[1], 'indent') ?? 0) || 0 : 0,
    });
  }
  return styles;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Numéro de série Excel → « AAAA-MM-JJ ». Le calendrier 1900 d'Excel compte à tort un 29 février 1900. */
export function serieEnDate(serie: number, systeme1904: boolean): string {
  const jours = Math.floor(serie);
  const base = systeme1904 ? Date.UTC(1904, 0, 1) : jours >= 61 ? Date.UTC(1899, 11, 30) : Date.UTC(1899, 11, 31);
  const d = new Date(base + jours * 864e5);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const colonne = (lettres: string) => lettres.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const MAX_LIGNES = 20000;
const MAX_COLONNES = 200;

function lireFeuille(xml: string, nom: string, textes: string[], styles: Style[], systeme1904: boolean): Feuille {
  const lignes: Cellule[][] = [];
  const retraits: number[][] = [];
  let suivante = 0;
  for (const rang of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const numero = attribut(rang[1], 'r');
    const y = numero ? Number(numero) - 1 : suivante;
    suivante = y + 1;
    if (y >= MAX_LIGNES || !rang[2]) continue;
    const ligne: Cellule[] = [];
    const ret: number[] = [];
    let x = -1;
    for (const c of rang[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /^([A-Za-z]+)\d*$/.exec(attribut(c[1], 'r') ?? '');
      x = ref ? colonne(ref[1].toUpperCase()) : x + 1;
      if (x >= MAX_COLONNES) continue;
      const style = styles[Number(attribut(c[1], 's') ?? 0)] ?? { date: false, pourcent: false, retrait: 0 };
      const type = attribut(c[1], 't') ?? 'n';
      const contenu = c[2] ?? '';
      const v = /<v\b[^>]*?(?:\/>|>([\s\S]*?)<\/v>)/.exec(contenu)?.[1];
      let valeur: Cellule = null;
      if (type === 's') valeur = v !== undefined ? textes[Number(v)] ?? null : null;
      else if (type === 'inlineStr') valeur = texteDe(contenu);
      else if (type === 'str') valeur = v !== undefined ? decoder(v) : null;
      else if (type === 'b') valeur = v === '1' ? 'VRAI' : v === '0' ? 'FAUX' : null;
      else if (type === 'd') valeur = v ? v.slice(0, 10) : null;
      else if (type === 'e') valeur = null;
      else if (v !== undefined && v.trim() !== '' && Number.isFinite(Number(v))) {
        const n = Number(v);
        valeur = style.date ? serieEnDate(n, systeme1904) : style.pourcent ? `${Math.round(n * 10000) / 100} %` : n;
      }
      if (typeof valeur === 'string' && valeur.trim() === '') valeur = null;
      while (ligne.length < x) ligne.push(null);
      ligne[x] = valeur;
      while (ret.length < x) ret.push(0);
      ret[x] = style.retrait;
    }
    while (lignes.length < y) {
      lignes.push([]);
      retraits.push([]);
    }
    lignes[y] = ligne;
    retraits[y] = ret;
  }
  while (lignes.length && lignes[lignes.length - 1].every((c) => c === null)) {
    lignes.pop();
    retraits.pop();
  }
  return { nom, lignes, retraits };
}

/** Chemin d'une feuille dans l'archive, d'après la cible indiquée par le classeur (relative à `xl/`, ou absolue). */
function chemin(cible: string): string {
  const parts = (cible.startsWith('/') ? cible.slice(1) : `xl/${cible}`).split('/');
  const sortie: string[] = [];
  for (const p of parts) {
    if (p === '..') sortie.pop();
    else if (p && p !== '.') sortie.push(p);
  }
  return sortie.join('/');
}

export function lireXlsx(octets: Uint8Array): Feuille[] {
  const zip = lireZip(octets);
  const classeur = zip.texte('xl/workbook.xml');
  if (!classeur) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx).");
  const liens = new Map<string, string>();
  for (const m of (zip.texte('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const id = attribut(m[1], 'Id');
    const cible = attribut(m[1], 'Target');
    if (id && cible) liens.set(id, chemin(cible));
  }
  const textes: string[] = [];
  for (const m of (zip.texte('xl/sharedStrings.xml') ?? '').matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)) textes.push(texteDe(m[1] ?? ''));
  const styles = lireStyles(zip.texte('xl/styles.xml'));
  const systeme1904 = /<workbookPr\b[^>]*date1904\s*=\s*"(1|true)"/i.test(classeur);

  const feuilles: Feuille[] = [];
  const noms = [...classeur.matchAll(/<sheet\b([^>]*?)\/?>/g)];
  noms.forEach((m, i) => {
    const etat = attribut(m[1], 'state');
    if (etat === 'hidden' || etat === 'veryHidden') return;
    const nom = attribut(m[1], 'name') ?? `Feuille ${i + 1}`;
    const rid = attribut(m[1], 'r:id');
    const fichier = (rid && liens.get(rid)) || `xl/worksheets/sheet${i + 1}.xml`;
    const xml = zip.texte(fichier);
    if (xml) feuilles.push(lireFeuille(xml, nom, textes, styles, systeme1904));
  });
  if (!feuilles.length) throw new Error('Ce classeur ne contient aucune feuille visible.');
  return feuilles;
}
