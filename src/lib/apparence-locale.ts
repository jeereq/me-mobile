import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { lireApparence, type ApparenceLocale } from './apparence-regles';
import { THEMES } from './theme';

export { themeAffiche } from './apparence-regles';

/**
 * Le thème choisi dans Mon compte, gardé sur l'appareil. Il ne vit pas dans l'espace : dans l'espace d'une équipe,
 * le choix s'enregistrait pour toute l'équipe (ou était refusé à un lecteur) et changeait en passant d'un espace à l'autre.
 */

const CLE = 'me:apparence';
let etat: { valeur: ApparenceLocale | null; lue: boolean } = { valeur: null, lue: false };
const abonnes = new Set<() => void>();
const changer = (e: typeof etat) => {
  etat = e;
  abonnes.forEach((f) => f());
};
const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};

Promise.resolve()
  .then(() => AsyncStorage.getItem(CLE))
  .then((brut) => changer({ valeur: lireApparence(brut, THEMES), lue: true }))
  .catch(() => changer({ valeur: null, lue: true }));

/** `null` : suivre la configuration de l'admin. */
export function definirApparence(v: ApparenceLocale | null) {
  const valeur = v?.theme ? { theme: v.theme, accent: v.accent ?? '' } : null;
  changer({ valeur, lue: true });
  (valeur ? AsyncStorage.setItem(CLE, JSON.stringify(valeur)) : AsyncStorage.removeItem(CLE)).catch(() => {});
}

export const useApparenceLocale = () => useSyncExternalStore(abonner, () => etat.valeur, () => null);
export const useApparenceLue = () => useSyncExternalStore(abonner, () => etat.lue, () => true);

