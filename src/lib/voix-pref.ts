import AsyncStorage from '@react-native-async-storage/async-storage';

/** Les choix de lecture et de dictée de cet appareil : la vitesse du lecteur et la langue de la dictée. */
const CLE = 'me.voix';
const VITESSES = [1, 1.25, 1.5, 0.75];
export const LANGUES_DICTEE = ['fr-FR', 'en-US', 'pt-PT'] as const;
export type LangueDictee = (typeof LANGUES_DICTEE)[number];

let vitesse = 1;
let dictee: LangueDictee = 'fr-FR';

Promise.resolve()
  .then(() => AsyncStorage.getItem(CLE))
  .then((b) => {
    const j = b ? (JSON.parse(b) as { vitesse?: number; dictee?: LangueDictee }) : null;
    if (j?.vitesse && VITESSES.includes(j.vitesse)) vitesse = j.vitesse;
    if (j?.dictee && LANGUES_DICTEE.includes(j.dictee)) dictee = j.dictee;
  })
  .catch(() => {});

const garder = () => void AsyncStorage.setItem(CLE, JSON.stringify({ vitesse, dictee })).catch(() => {});

export const vitesseLecture = () => vitesse;
export const vitesseSuivante = (v: number) => VITESSES[(VITESSES.indexOf(v) + 1) % VITESSES.length];
export function choisirVitesseLecture(v: number) {
  vitesse = v;
  garder();
}
export const langueDictee = () => dictee;
export function choisirLangueDictee(l: LangueDictee) {
  dictee = l;
  garder();
}
