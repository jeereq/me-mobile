import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore, type ComponentPropsWithRef, type ComponentRef } from 'react';
import { Dimensions, Platform, StyleSheet, Text as TextRN, TextInput as TextInputRN } from 'react-native';

import { LARGEUR_BUREAU } from '@/lib/mise-en-page';
import { echelleDe, lireTaille, tailleAjustee, type TailleTexte } from '@/lib/taille-texte';

/**
 * Tous les textes de l'app passent par ici pour suivre la taille choisie dans Compte > Apparence.
 * Le choix reste sur l'appareil : un téléphone et un ordinateur n'ont pas les mêmes besoins.
 */

const CLE = 'me:taille-texte';
const mobileMaintenant = () => Platform.OS !== 'web' || Dimensions.get('window').width < LARGEUR_BUREAU;

let etat = { cle: 'normal' as TailleTexte, mobile: mobileMaintenant(), lue: false };
const abonnes = new Set<() => void>();
const changer = (partiel: Partial<typeof etat>) => {
  etat = { ...etat, ...partiel };
  abonnes.forEach((f) => f());
};
const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};

Dimensions.addEventListener('change', () => {
  const mobile = mobileMaintenant();
  if (mobile !== etat.mobile) changer({ mobile });
});
Promise.resolve()
  .then(() => AsyncStorage.getItem(CLE))
  .then((brut) => changer(brut ? { cle: lireTaille(brut), lue: true } : { lue: true }))
  .catch(() => changer({ lue: true }));

export function definirTailleTexte(cle: TailleTexte) {
  changer({ cle });
  AsyncStorage.setItem(CLE, cle).catch(() => {});
}

const echelle = () => echelleDe(etat.cle, etat.mobile);
export const useEchelleTexte = () => useSyncExternalStore(abonner, echelle, () => 1);
/**
 * L'échelle du reste du design (boutons, champs, cases, marges internes) : elle suit celle du texte, un peu atténuée pour
 * que la page garde sa largeur utile. Les icônes, elles, suivent le texte tel quel (voir `Icone`).
 */
export const echelleUi = () => 1 + (echelle() - 1) * 0.7;
export const useEchelleUi = () => useSyncExternalStore(abonner, echelleUi, () => 1);
/** Prévient quand la taille choisie change (les feuilles de style communes se recalculent). */
export const surEchelle = (f: () => void) => abonner(f);
export const useTailleTexte = () => useSyncExternalStore(abonner, () => etat.cle, () => 'normal' as TailleTexte);
/** Le réglage n'a de sens que sur une vue mobile. */
export const useVueMobile = () => useSyncExternalStore(abonner, () => etat.mobile, () => true);
/** Le choix enregistré est lu : l'écran de démarrage peut laisser place à l'app sans que le texte saute. */
export const useTailleLue = () => useSyncExternalStore(abonner, () => etat.lue, () => true);

/** `fixe` : un texte dessiné dans une forme de taille fixe (logo dans un cercle, barre d'onglets). */
export function Text({ fixe, style, ...reste }: ComponentPropsWithRef<typeof TextRN> & { fixe?: boolean }) {
  const e = useEchelleTexte();
  return <TextRN {...reste} style={fixe || e === 1 ? style : [style, tailleAjustee(StyleSheet.flatten(style), e)]} />;
}

export function TextInput({ style, ...reste }: ComponentPropsWithRef<typeof TextInputRN>) {
  const e = useEchelleTexte();
  return <TextInputRN {...reste} style={e === 1 ? style : [style, tailleAjustee(StyleSheet.flatten(style), e)]} />;
}

/** Pour `useRef<TextInput>` : le type du champ, comme avec celui de react-native. */
export type TextInput = ComponentRef<typeof TextInputRN>;
