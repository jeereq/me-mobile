import { inflate } from './inflate';

/**
 * Lecture d'une archive ZIP (un .xlsx en est une) : liste des fichiers, contenu à la demande.
 * Prend l'annuaire central à la fin de l'archive, comme tous les lecteurs, donc les fichiers écrits « en flux » passent aussi.
 *
 * Ce fichier n'importe que `inflate` : il se teste avec `npm test`.
 */

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Texte UTF-8 (BOM retiré) ; sans dépendre de `TextDecoder`, que tous les moteurs JavaScript n'ont pas. */
export function utf8(b: Uint8Array): string {
  let i = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0;
  const morceaux: string[] = [];
  let tas: number[] = [];
  const vider = () => {
    morceaux.push(String.fromCharCode(...tas));
    tas = [];
  };
  while (i < b.length) {
    const c = b[i++];
    let cp = c;
    if (c >= 0xf0) cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xe0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xc0) cp = ((c & 31) << 6) | (b[i++] & 63);
    else if (c >= 0x80) cp = 0xfffd;
    if (cp > 0xffff) {
      cp -= 0x10000;
      tas.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023));
    } else tas.push(cp);
    if (tas.length > 4000) vider();
  }
  vider();
  return morceaux.join('');
}

export type EntreeZip = { nom: string; taille: number };
export type Zip = {
  noms: string[];
  /** Contenu décompressé d'un fichier de l'archive, ou null s'il n'y est pas. */
  lire: (nom: string) => Uint8Array | null;
  texte: (nom: string) => string | null;
};

export function lireZip(octets: Uint8Array): Zip {
  // Fin de l'annuaire : signature 0x06054b50, dans les 64 Ko + 22 octets de la fin (le commentaire peut y être).
  let fin = -1;
  for (let i = octets.length - 22; i >= Math.max(0, octets.length - 22 - 65535); i--) {
    if (octets[i] === 0x50 && octets[i + 1] === 0x4b && octets[i + 2] === 5 && octets[i + 3] === 6) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error("Ce fichier n'est pas une archive ZIP valide.");
  const nb = u16(octets, fin + 10);
  const debutAnnuaire = u32(octets, fin + 16);
  if (nb === 0xffff || debutAnnuaire === 0xffffffff) throw new Error('Archive trop volumineuse (ZIP64) : enregistre le classeur plus léger.');

  const entrees = new Map<string, { methode: number; taille: number; tailleCompressee: number; local: number }>();
  let o = debutAnnuaire;
  for (let k = 0; k < nb; k++) {
    if (o + 46 > octets.length || u32(octets, o) !== 0x02014b50) throw new Error('Archive ZIP endommagée.');
    const methode = u16(octets, o + 10);
    const tailleCompressee = u32(octets, o + 20);
    const taille = u32(octets, o + 24);
    const n = u16(octets, o + 28);
    const extra = u16(octets, o + 30);
    const commentaire = u16(octets, o + 32);
    const local = u32(octets, o + 42);
    entrees.set(utf8(octets.subarray(o + 46, o + 46 + n)), { methode, taille, tailleCompressee, local });
    o += 46 + n + extra + commentaire;
  }

  const lire = (nom: string): Uint8Array | null => {
    const e = entrees.get(nom);
    if (!e) return null;
    if (u32(octets, e.local) !== 0x04034b50) throw new Error('Archive ZIP endommagée.');
    const debut = e.local + 30 + u16(octets, e.local + 26) + u16(octets, e.local + 28);
    const brut = octets.subarray(debut, debut + e.tailleCompressee);
    if (e.methode === 0) return brut.slice();
    if (e.methode !== 8) throw new Error(`Compression ZIP non prise en charge (méthode ${e.methode}).`);
    const r = inflate(brut, e.taille);
    if (r.length !== e.taille) throw new Error('Archive ZIP endommagée.');
    return r;
  };
  return {
    noms: [...entrees.keys()],
    lire,
    texte: (nom) => {
      const b = lire(nom);
      return b ? utf8(b) : null;
    },
  };
}
