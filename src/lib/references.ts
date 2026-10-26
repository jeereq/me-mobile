/**
 * Références de transaction : éviter d'importer deux fois la même opération bancaire.
 *
 * Une référence seule ne suffit pas : sur beaucoup de relevés, un retrait, ses frais et sa TVA partagent la même référence.
 * La clé d'une opération combine donc la référence, la date, le sens, le montant et le libellé tel que la banque l'écrit ;
 * deux lignes strictement identiques dans un même fichier (deux frais de 1,00 le même jour) reçoivent un numéro (« #2 »),
 * pour que la deuxième ne soit pas prise pour un doublon de la première, et que réimporter le même fichier retombe sur les mêmes clés.
 *
 * Ce fichier n'importe rien : il se teste avec `npm test`.
 */

const norme = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Clé d'une opération, ou null quand le relevé n'a pas de référence pour cette ligne. */
export function cleReference(reference: string | null | undefined, date: string, genre: 'depense' | 'revenu', montant: number, libelleBrut: string): string | null {
  const ref = (reference ?? '').trim();
  if (!ref) return null;
  return [ref, date, genre === 'depense' ? 'd' : 'r', montant.toFixed(2), norme(libelleBrut)].join('|');
}

/** Numérote les clés qui reviennent dans le même fichier : la 2e occurrence devient « …#2 », la 3e « …#3 ». Les null restent null. */
export function numeroter(cles: (string | null)[]): (string | null)[] {
  const vues = new Map<string, number>();
  return cles.map((c) => {
    if (c === null) return null;
    const n = (vues.get(c) ?? 0) + 1;
    vues.set(c, n);
    return n === 1 ? c : `${c}#${n}`;
  });
}

export type LigneARepere = { reference: string | null; /** Clé « date + montant » des anciens imports, sans référence. */ ancienne: string };

/**
 * Repère les doublons d'un fichier.
 * - Une opération dont la référence est déjà enregistrée est un doublon.
 * - Sinon, elle peut correspondre à une opération notée sans référence (ancien import, saisie à la main) de même date et même montant ;
 *   chacune de ces opérations n'écarte qu'une ligne, pour ne pas masquer des opérations semblables mais distinctes.
 */
export function reperer(lignes: LigneARepere[], referencesConnues: Set<string>, anciennes: string[]): boolean[] {
  const reste = new Map<string, number>();
  for (const a of anciennes) reste.set(a, (reste.get(a) ?? 0) + 1);
  return lignes.map((l) => {
    if (l.reference && referencesConnues.has(l.reference)) return true;
    const n = reste.get(l.ancienne) ?? 0;
    if (n > 0) {
      reste.set(l.ancienne, n - 1);
      return true;
    }
    return false;
  });
}
