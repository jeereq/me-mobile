/** Un morceau d'enregistrement : son fichier, puis son texte ou la raison de l'échec. */
export type Morceau = { n: number; uri: string; /** Web : le contenu du fichier. */ blob?: Blob; dureeMs: number; texte?: string; erreur?: string };

/** Le texte de la réunion : les morceaux transcrits, dans l'ordre. */
export const assembler = (morceaux: Morceau[]) =>
  [...morceaux]
    .sort((a, b) => a.n - b.n)
    .map((m) => m.texte?.trim())
    .filter(Boolean)
    .join('\n\n');

/** Les morceaux qui n'ont pas encore de texte. */
export const manquants = (morceaux: Morceau[]) => morceaux.filter((m) => m.texte === undefined);
