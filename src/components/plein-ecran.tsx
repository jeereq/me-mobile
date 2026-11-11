import { useEffect, useRef, type ReactNode } from 'react';
import { Modal, Platform, ScrollView, View } from 'react-native';

import { useZonesSures } from '@/lib/mise-en-page';
import { C, F, S } from '@/lib/theme';
import { useThemeCle } from '@/lib/theme-cle';

import { Text } from './texte';
import { Btn } from './ui';

/** Sur le web, passe la page en plein écran (à appeler dans le geste de l'utilisateur) ; ailleurs, le volet suffit. */
export const entrerPleinEcran = () => {
  if (Platform.OS === 'web') (document.documentElement as HTMLElement).requestFullscreen?.().catch(() => {});
};
const sortirPleinEcran = () => {
  if (Platform.OS === 'web' && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
};

/**
 * Un volet qui occupe tout l'écran, avec une barre en haut (titre, « Fermer ») et, dessous, le contenu qui défile (réglages, filtres, puis le corps).
 * Sur le web, la page passe aussi en plein écran du navigateur ; Échap quitte les deux.
 */
export function PleinEcran({ titre, onFermer, entete, children }: { titre: string; onFermer: () => void; /** En haut du contenu : réglages et filtres. */ entete?: ReactNode; children: ReactNode }) {
  const cle = useThemeCle();
  const { haut, bas } = useZonesSures();
  // `onFermer` change à chaque affichage du parent : on le lit par une référence pour ne pas relancer l'effet (et sortir du plein écran) à chaque clic.
  const fermer = useRef(onFermer);
  useEffect(() => {
    fermer.current = onFermer;
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer.current();
    };
    // Échap sort d'abord du plein écran du navigateur : le volet se ferme avec lui.
    const surChangement = () => {
      if (!document.fullscreenElement) fermer.current();
    };
    window.addEventListener('keydown', surTouche);
    document.addEventListener('fullscreenchange', surChangement);
    return () => {
      window.removeEventListener('keydown', surTouche);
      document.removeEventListener('fullscreenchange', surChangement);
      sortirPleinEcran();
    };
  }, []);
  return (
    <Modal visible statusBarTranslucent animationType="fade" onRequestClose={onFermer}>
      <View key={cle} style={{ flex: 1, backgroundColor: C.bg, paddingTop: haut, paddingBottom: bas }}>
        <View style={{ gap: 10, paddingHorizontal: S.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texteF, fontSize: 18 }}>{titre}</Text>
            <Btn small kind="sec" label="Fermer" onPress={onFermer} />
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: S.lg, gap: S.md }} keyboardShouldPersistTaps="handled">
          {entete}
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}
