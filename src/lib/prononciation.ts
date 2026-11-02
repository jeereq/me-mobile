/**
 * Prononciation du nom de l'app par la synthèse vocale. L'app s'appelle « Me », à dire à l'anglaise (« mi », comme le mot-clé
 * « Hey Me »), mais une voix française lit « Me » comme le pronom « me » (« meuh »). Avant de parler, on écrit donc le nom
 * comme il se prononce en français : « Mi ». Seul le nom change : le pronom en minuscules (« il me dit ») et « Me » en tête
 * de phrase devant un infinitif ou « voici » (« Me rappeler demain », « Me voilà ») restent tels quels.
 */

// Mots qui, juste après « Me » en début de phrase, font du « Me » un pronom et non le nom de l'app.
const APRES_PRONOM = /^(?:\p{L}+(?:er|ir|re|oir|ant)|voici|voilà|voila)$/iu;

export function prononcerNom(texte: string): string {
  return texte.replace(/(?<![\p{L}\p{N}'’-])Me(?![\p{L}\p{N}'’-])/gu, (m, i: number, s: string) => {
    const avant = s.slice(0, i);
    const debutDePhrase = /(?:^|[.!?…:]\s*|\n\s*)$/u.test(avant) && !/[«"“]\s*$/u.test(avant);
    const suivant = /^\s+(\p{L}+)/u.exec(s.slice(i + m.length))?.[1] ?? '';
    return debutDePhrase && APRES_PRONOM.test(suivant) ? m : 'Mi';
  });
}
