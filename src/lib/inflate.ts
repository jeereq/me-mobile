/**
 * Décompression « deflate » (RFC 1951), celle des fichiers ZIP, donc des .xlsx.
 * Écrite ici plutôt qu'importée : l'app n'a pas de bibliothèque de décompression, et celle-ci tient en cent lignes.
 * Même méthode que `puff.c` de zlib : lente en théorie, très suffisante pour une feuille de calcul de quelques Mo.
 *
 * Ce fichier n'importe rien : il se teste avec `npm test` (contre zlib).
 */

const LONGUEURS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LONGUEURS_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DISTANCES = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DISTANCES_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const ORDRE_LONGUEURS = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

type Huffman = { compte: Uint16Array; symbole: Uint16Array };

/** Table de décodage canonique à partir des longueurs de code de chaque symbole. */
function table(longueurs: ArrayLike<number>, n: number): Huffman {
  const compte = new Uint16Array(16);
  for (let i = 0; i < n; i++) compte[longueurs[i]]++;
  const decalage = new Uint16Array(16);
  for (let l = 1; l < 15; l++) decalage[l + 1] = decalage[l] + compte[l];
  const symbole = new Uint16Array(n);
  for (let i = 0; i < n; i++) if (longueurs[i]) symbole[decalage[longueurs[i]]++] = i;
  return { compte, symbole };
}

const FIXE_LITTERAUX = (() => {
  const l = new Uint8Array(288);
  for (let i = 0; i < 144; i++) l[i] = 8;
  for (let i = 144; i < 256; i++) l[i] = 9;
  for (let i = 256; i < 280; i++) l[i] = 7;
  for (let i = 280; i < 288; i++) l[i] = 8;
  return table(l, 288);
})();
const FIXE_DISTANCES = table(new Uint8Array(30).fill(5), 30);

/** Décompresse un flux deflate brut. `tailleAttendue` évite de réallouer quand on la connaît (ZIP). */
export function inflate(src: Uint8Array, tailleAttendue = 0): Uint8Array {
  let sortie = new Uint8Array(Math.max(tailleAttendue, src.length * 3, 64));
  let n = 0;
  let pos = 0;
  let tampon = 0;
  let nbits = 0;

  const bits = (k: number): number => {
    while (nbits < k) {
      if (pos >= src.length) throw new Error('Fichier compressé tronqué.');
      tampon |= src[pos++] << nbits;
      nbits += 8;
    }
    const v = tampon & ((1 << k) - 1);
    tampon >>>= k;
    nbits -= k;
    return v;
  };
  const decoder = (h: Huffman): number => {
    let code = 0;
    let premier = 0;
    let index = 0;
    for (let l = 1; l <= 15; l++) {
      code |= bits(1);
      const c = h.compte[l];
      if (code - c < premier) return h.symbole[index + (code - premier)];
      index += c;
      premier = (premier + c) << 1;
      code <<= 1;
    }
    throw new Error('Fichier compressé invalide.');
  };
  const place = (k: number) => {
    if (n + k <= sortie.length) return;
    const plus = new Uint8Array(Math.max(sortie.length * 2, n + k));
    plus.set(sortie.subarray(0, n));
    sortie = plus;
  };

  const codes = (lit: Huffman, dist: Huffman) => {
    for (;;) {
      const s = decoder(lit);
      if (s < 256) {
        place(1);
        sortie[n++] = s;
      } else if (s === 256) return;
      else {
        const i = s - 257;
        if (i >= 29) throw new Error('Fichier compressé invalide.');
        const longueur = LONGUEURS[i] + bits(LONGUEURS_EXTRA[i]);
        const d = decoder(dist);
        if (d >= 30) throw new Error('Fichier compressé invalide.');
        const distance = DISTANCES[d] + bits(DISTANCES_EXTRA[d]);
        if (distance > n) throw new Error('Fichier compressé invalide.');
        place(longueur);
        for (let k = 0; k < longueur; k++, n++) sortie[n] = sortie[n - distance];
      }
    }
  };

  let dernier = 0;
  while (!dernier) {
    dernier = bits(1);
    const type = bits(2);
    if (type === 0) {
      // Bloc non compressé : on repart à l'octet suivant.
      tampon = 0;
      nbits = 0;
      if (pos + 4 > src.length) throw new Error('Fichier compressé tronqué.');
      const len = src[pos] | (src[pos + 1] << 8);
      const nlen = src[pos + 2] | (src[pos + 3] << 8);
      if ((len ^ 0xffff) !== nlen) throw new Error('Fichier compressé invalide.');
      pos += 4;
      if (pos + len > src.length) throw new Error('Fichier compressé tronqué.');
      place(len);
      sortie.set(src.subarray(pos, pos + len), n);
      n += len;
      pos += len;
    } else if (type === 1) codes(FIXE_LITTERAUX, FIXE_DISTANCES);
    else if (type === 2) {
      const nlen = bits(5) + 257;
      const ndist = bits(5) + 1;
      const ncode = bits(4) + 4;
      if (nlen > 286 || ndist > 30) throw new Error('Fichier compressé invalide.');
      const l = new Uint8Array(320);
      for (let i = 0; i < ncode; i++) l[ORDRE_LONGUEURS[i]] = bits(3);
      const tCodes = table(l, 19);
      const longueurs = new Uint8Array(nlen + ndist);
      for (let i = 0; i < nlen + ndist; ) {
        const s = decoder(tCodes);
        if (s < 16) longueurs[i++] = s;
        else {
          let v = 0;
          let rep: number;
          if (s === 16) {
            if (i === 0) throw new Error('Fichier compressé invalide.');
            v = longueurs[i - 1];
            rep = 3 + bits(2);
          } else if (s === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          if (i + rep > nlen + ndist) throw new Error('Fichier compressé invalide.');
          while (rep--) longueurs[i++] = v;
        }
      }
      codes(table(longueurs.subarray(0, nlen), nlen), table(longueurs.subarray(nlen), ndist));
    } else throw new Error('Fichier compressé invalide.');
  }
  return sortie.slice(0, n);
}
