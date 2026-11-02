/**
 * Prononciation du nom de l'app par la synthèse vocale. L'app s'appelle « Me », à dire à l'anglaise (« mi », comme le mot-clé
 * « Hey Me »), mais une voix française lit « Me » comme le pronom « me » (« meuh »). Avant de parler, on écrit donc le nom
 * comme il se prononce en français : « Mi ». Seul le nom change : le pronom en minuscules (« il me dit ») et « Me » en tête
 * de phrase devant un infinitif ou « voici » (« Me rappeler demain », « Me voilà ») restent tels quels.
 *
 * Si l'utilisateur a donné un autre nom à l'app (« Jarvis »), c'est ce nom que la voix dit à la place de « Me », avec les mêmes
 * règles : les textes écrits pour « Me » (« Me te prévient la veille ») parlent alors sous son nom.
 */
import { NOM_APP_DEFAUT } from './commun/nom-app';
import { nomCourant } from './nom';


// Mots qui, juste après « Me » en début de phrase, font du « Me » un pronom et non le nom de l'app.
const APRES_PRONOM = /^(?:\p{L}+(?:er|ir|re|oir|ant)|voici|voilà|voila)$/iu;

export function prononcerNom(texte: string, nom: string = nomCourant()): string {
  const dit = nom === NOM_APP_DEFAUT ? 'Mi' : nom;
  return texte.replace(/(?<![\p{L}\p{N}'’-])Me(?![\p{L}\p{N}'’-])/gu, (m, i: number, s: string) => {
    const avant = s.slice(0, i);
    const debutDePhrase = /(?:^|[.!?…:]\s*|\n\s*)$/u.test(avant) && !/[«"“]\s*$/u.test(avant);
    const suivant = /^\s+(\p{L}+)/u.exec(s.slice(i + m.length))?.[1] ?? '';
    return debutDePhrase && APRES_PRONOM.test(suivant) ? m : dit;
  });
}
