import { deflateRawSync } from 'node:zlib';

/** Construit une archive ZIP à la main : en-têtes locaux, annuaire central, fin d'annuaire. */
export function fabriquerZip(fichiers: Record<string, Uint8Array | string>, opts: { niveau?: number; commentaire?: string; stocke?: boolean } = {}): Uint8Array {
  const morceaux: Buffer[] = [];
  const annuaire: Buffer[] = [];
  let pos = 0;
  for (const [nom, contenu] of Object.entries(fichiers)) {
    const donnees = Buffer.from(typeof contenu === 'string' ? Buffer.from(contenu, 'utf8') : contenu);
    const methode = opts.stocke ? 0 : 8;
    const comp = opts.stocke ? donnees : deflateRawSync(donnees, { level: opts.niveau ?? 6 });
    const n = Buffer.from(nom, 'utf8');
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0);
    loc.writeUInt16LE(20, 4);
    loc.writeUInt16LE(0x0800, 6);
    loc.writeUInt16LE(methode, 8);
    loc.writeUInt32LE(comp.length, 18);
    loc.writeUInt32LE(donnees.length, 22);
    loc.writeUInt16LE(n.length, 26);
    const extra = Buffer.from([1, 2, 3, 4]); // champ « extra » dont la taille diffère de celle de l'annuaire
    loc.writeUInt16LE(extra.length, 28);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(methode, 10);
    cen.writeUInt32LE(comp.length, 20);
    cen.writeUInt32LE(donnees.length, 24);
    cen.writeUInt16LE(n.length, 28);
    cen.writeUInt32LE(pos, 42);
    annuaire.push(cen, n);
    morceaux.push(loc, n, extra, comp);
    pos += 30 + n.length + extra.length + comp.length;
  }
  const dir = Buffer.concat(annuaire);
  const comm = Buffer.from(opts.commentaire ?? '', 'utf8');
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(Object.keys(fichiers).length, 8);
  fin.writeUInt16LE(Object.keys(fichiers).length, 10);
  fin.writeUInt32LE(dir.length, 12);
  fin.writeUInt32LE(pos, 16);
  fin.writeUInt16LE(comm.length, 20);
  return new Uint8Array(Buffer.concat([...morceaux, dir, fin, comm]));
}

export type CelluleXlsx = string | number | boolean | null | { date: number; style?: 'iso' | 'perso' | 'long' } | { pct: number } | { inline: string } | { formule: string; v: string | number } | { texte: string; retrait: number } | { heure: number } | { erreur: string };
const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Construit un petit classeur .xlsx (avec chaînes partagées, styles de date, pourcentage et retrait) pour les tests. */
export function fabriquerXlsx(feuilles: { nom: string; lignes: CelluleXlsx[][]; cachee?: boolean }[], opts: { systeme1904?: boolean; cibleAbsolue?: boolean } = {}): Uint8Array {
  const partages: string[] = [];
  const idx = (t: string) => {
    let i = partages.indexOf(t);
    if (i < 0) i = partages.push(t) - 1;
    return i;
  };
  const lettres = (x: number) => {
    let s = '';
    for (let n = x + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  const xmlFeuille = (lignes: CelluleXlsx[][]) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` +
    lignes
      .map((l, y) => {
        const cells = l
          .map((c, x) => {
            const r = `${lettres(x)}${y + 1}`;
            if (c === null) return `<c r="${r}"/>`;
            if (typeof c === 'number') return `<c r="${r}"><v>${c}</v></c>`;
            if (typeof c === 'boolean') return `<c r="${r}" t="b"><v>${c ? 1 : 0}</v></c>`;
            if (typeof c === 'string') return `<c r="${r}" t="s"><v>${idx(c)}</v></c>`;
            if ('date' in c) return `<c r="${r}" s="${c.style === 'perso' ? 2 : c.style === 'long' ? 7 : 1}"><v>${c.date}</v></c>`;
            if ('pct' in c) return `<c r="${r}" s="3"><v>${c.pct}</v></c>`;
            if ('inline' in c) return `<c r="${r}" t="inlineStr"><is><t>${echapper(c.inline)}</t></is></c>`;
            if ('formule' in c) return `<c r="${r}" t="${typeof c.v === 'string' ? 'str' : 'n'}"><f>A1+1</f><v>${echapper(String(c.v))}</v></c>`;
            if ('texte' in c) return `<c r="${r}" s="${c.retrait === 1 ? 4 : 5}" t="s"><v>${idx(c.texte)}</v></c>`;
            if ('heure' in c) return `<c r="${r}" s="6"><v>${c.heure}</v></c>`;
            return `<c r="${r}" t="e"><v>${c.erreur}</v></c>`;
          })
          .join('');
        return `<row r="${y + 1}">${cells}</row>`;
      })
      .join('') +
    `</sheetData></worksheet>`;
  const xmls = feuilles.map((f) => xmlFeuille(f.lignes));
  const cible = (i: number) => (opts.cibleAbsolue ? `/xl/worksheets/s${i + 1}.xml` : `worksheets/s${i + 1}.xml`);
  const fichiers: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${opts.systeme1904 ? '<workbookPr date1904="1"/>' : '<workbookPr/>'}<sheets>${feuilles
      .map((f, i) => `<sheet name="${echapper(f.nom)}" sheetId="${i + 1}"${f.cachee ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${feuilles
      .map((_f, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${cible(i)}"/>`)
      .join('')}</Relationships>`,
    'xl/styles.xml': `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="h:mm"/><numFmt numFmtId="166" formatCode="[$-40C]d\\ mmmm\\ yyyy;@"/></numFmts><cellStyleXfs count="1"><xf numFmtId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="9"/><xf numFmtId="0" applyAlignment="1"><alignment horizontal="left" indent="1"/></xf><xf numFmtId="0" applyAlignment="1"><alignment indent="2"/></xf><xf numFmtId="165"/><xf numFmtId="166"/></cellXfs></styleSheet>`,
  };
  feuilles.forEach((_f, i) => (fichiers[`xl/worksheets/s${i + 1}.xml`] = xmls[i]));
  // Les chaînes partagées sont connues une fois les feuilles écrites.
  fichiers['xl/sharedStrings.xml'] = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${partages.length}" uniqueCount="${partages.length}">${partages
    .map((t, i) => (i % 2 ? `<si><r><rPr><b/></rPr><t xml:space="preserve">${echapper(t)}</t></r></si>` : `<si><t xml:space="preserve">${echapper(t)}</t></si>`))
    .join('')}</sst>`;
  return fabriquerZip(fichiers);
}
