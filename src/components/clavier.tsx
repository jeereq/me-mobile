import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

import { hauteurClavier, placementChamp } from '@/lib/clavier';

/** La place prise par le clavier, sur le téléphone comme dans le navigateur, pour que le champ en cours de saisie reste visible. */

let hauteur = 0;
const abonnes = new Set<() => void>();
const definir = (h: number) => {
  if (h === hauteur) return;
  hauteur = h;
  abonnes.forEach((f) => f());
};
const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};

if (Platform.OS !== 'web') {
  Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => definir(e.endCoordinates.height));
  Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => definir(0));
} else if (typeof window !== 'undefined' && window.visualViewport) {
  const v = window.visualViewport;
  const mesurer = () => definir(hauteurClavier(window.innerHeight, v.height, v.offsetTop));
  v.addEventListener('resize', mesurer);
  v.addEventListener('scroll', mesurer);
}

export const useClavier = () =>
  useSyncExternalStore(
    abonner,
    () => hauteur,
    () => 0,
  );

/** Garde son contenu au-dessus du clavier. */
export function EviteClavier({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const h = useClavier();
  if (Platform.OS === 'web') return <View style={[style, h ? { paddingBottom: h } : null]}>{children}</View>;
  return (
    <KeyboardAvoidingView behavior="padding" style={style}>
      {children}
    </KeyboardAvoidingView>
  );
}

/** Dans le navigateur : ramène le champ en cours de saisie dans la zone visible, à l'ouverture du clavier et à chaque changement de champ. */
export function useChampVisible() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let attente: ReturnType<typeof setTimeout> | undefined;
    const montrer = () => {
      const champ = document.activeElement;
      if (!hauteur || !(champ instanceof HTMLElement) || !/^(INPUT|TEXTAREA)$/.test(champ.tagName)) return;
      champ.scrollIntoView({ block: placementChamp(champ.tagName), behavior: 'smooth' });
    };
    // Après la mise en page : la fenêtre vient de se réduire.
    const planifier = () => {
      clearTimeout(attente);
      attente = setTimeout(montrer, 80);
    };
    document.addEventListener('focusin', planifier);
    const desabonner = abonner(planifier);
    return () => {
      clearTimeout(attente);
      document.removeEventListener('focusin', planifier);
      desabonner();
    };
  }, []);
}
