import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { useZonesSures } from '@/lib/mise-en-page';
import { C, F, ombre, S } from '@/lib/theme';
import { useThemeCle } from '@/lib/theme-cle';

import { useClavier } from './clavier';
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
 * Un volet immersif : le contenu occupe toute la page, sous une barre fine (titre, filtres posés en étiquettes, « Fermer »).
 * Les commandes flottent en bas dans un dock (`reglages` : l'échelle, « Aujourd'hui » ; puis « Filtres »), qui ouvre
 * au-dessus de lui le panneau `filtres`. Sur le web, la page passe aussi en plein écran du navigateur ; Échap quitte les deux.
 */
export function PleinEcran({ titre, compte, etiquettes, reglages, filtres, nbFiltres = 0, onFermer, children }: { titre: string; onFermer: () => void; /** « 9 tâches sur 10 » : ce que montrent les filtres. */ compte?: string; /** Les filtres posés, à retirer d'un geste. */ etiquettes?: ReactNode; reglages?: ReactNode; /** Le panneau des filtres ; sans lui, pas de bouton « Filtres ». */ filtres?: ReactNode; nbFiltres?: number; children: ReactNode }) {
  const cle = useThemeCle();
  const { haut, bas } = useZonesSures();
  const { height } = useWindowDimensions();
  const clavier = useClavier();
  const [panneau, setPanneau] = useState(false);
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
      <View key={cle} style={{ flex: 1, backgroundColor: C.bg, paddingTop: haut }}>
        <View style={{ gap: 8, paddingHorizontal: S.lg, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
            <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texteF, fontSize: 18 }}>{titre}</Text>
            {compte ? <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{compte}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer le plein écran" onPress={onFermer} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>
          {etiquettes}
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: S.md, paddingBottom: 200 + bas }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        <View pointerEvents="box-none" style={{ position: 'absolute', left: S.md, right: S.md, bottom: bas + S.lg + clavier, alignItems: 'center' }}>
          <View pointerEvents="box-none" style={{ width: '100%', maxWidth: 640, gap: 10 }}>
            {panneau && filtres ? (
              <View style={{ maxHeight: Math.max(220, height * 0.55 - clavier), borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, overflow: 'hidden', ...ombre() }}>
                <ScrollView contentContainerStyle={{ padding: S.lg }} keyboardShouldPersistTaps="handled">
                  {filtres}
                </ScrollView>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 8, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, ...ombre() }}>
              {reglages}
              {filtres ? (
                <View style={{ marginLeft: 'auto' }}>
                  <Btn small kind={panneau || nbFiltres ? 'primary' : 'sec'} label={nbFiltres ? `Filtres · ${nbFiltres}` : 'Filtres'} onPress={() => setPanneau(!panneau)} />
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
