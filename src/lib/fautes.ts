/** Les fautes de français trouvées dans un mail : ce qui est fautif, sa correction, et la règle. */
export type GenreFaute = 'orthographe' | 'grammaire' | 'accord' | 'conjugaison' | 'ponctuation' | 'typographie';
export type Faute = { avant: string; apres: string; genre: GenreFaute; raison: string };
export type Verification = { texte: string; corrections: Faute[] };

export const GENRES_FAUTE: Record<GenreFaute, string> = {
  orthographe: 'Orthographe',
  grammaire: 'Grammaire',
  accord: 'Accord',
  conjugaison: 'Conjugaison',
  ponctuation: 'Ponctuation',
  typographie: 'Typographie',
};

/**
 * Où la faute se trouve encore dans le texte (-1 si elle n'y est plus). Une correction qui contient la faute
 * (« envoi » → « envoie ») ne se retrouve pas dans un passage déjà corrigé.
 */
function trouver(texte: string, f: Faute): number {
  if (!f.avant) return -1;
  for (let i = texte.indexOf(f.avant); i >= 0; i = texte.indexOf(f.avant, i + 1)) {
    let corrigee = false;
    for (let p = f.apres.indexOf(f.avant); p >= 0 && !corrigee; p = f.apres.indexOf(f.avant, p + 1)) corrigee = i - p >= 0 && texte.startsWith(f.apres, i - p);
    if (!corrigee) return i;
  }
  return -1;
}

/** Les fautes qu'on peut encore corriger dans ce texte : celles qui y sont toujours (le texte a pu changer depuis). */
export const fautesRestantes = (texte: string, fautes: Faute[]) => fautes.filter((f) => trouver(texte, f) >= 0);

/** Corrige une faute, à sa première occurrence. */
export function corrigerUne(texte: string, f: Faute): string {
  const i = trouver(texte, f);
  return i < 0 ? texte : texte.slice(0, i) + f.apres + texte.slice(i + f.avant.length);
}

/** Corrige toutes les fautes qui restent. Tant que le texte est celui qui a été vérifié, c'est le texte corrigé par le serveur. */
export function corrigerToutes(texte: string, v: { verifie: string; corrige: string }, fautes: Faute[]): string {
  if (texte === v.verifie) return v.corrige;
  return fautesRestantes(texte, fautes).reduce(corrigerUne, texte);
}
