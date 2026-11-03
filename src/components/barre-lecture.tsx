import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { etatLecture, pauseLecture, reprendreLecture, surLecture, taire } from '@/lib/assistant';
import { useBarreOnglets } from '@/lib/mise-en-page';
import { alpha, C, F, ombreAvant, surfaceHaute } from '@/lib/theme';

import { Icone } from './icones';
import { Ondes } from './ondes';

// Une fenêtre (Modal) passe au-dessus de tout : la barre s'affiche alors dedans, et non derrière.
let fenetres = 0;
const abonnes = new Set<() => void>();
const direFenetres = (n: number) => {
  fenetres = n;
  abonnes.forEach((f) => f());
};
const surFenetres = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};
const nbFenetres = () => fenetres;

export function useFenetreOuverte() {
  useEffect(() => {
    direFenetres(fenetres + 1);
    return () => direFenetres(fenetres - 1);
  }, []);
}

/** Tant que l'app lit quelque chose à voix haute : les ondes, ce qui est lu, la pause et l'arrêt, sur tous les écrans. */
export function BarreLecture({ dansFenetre }: { dansFenetre?: boolean }) {
  const l = useSyncExternalStore(surLecture, etatLecture, etatLecture);
  const n = useSyncExternalStore(surFenetres, nbFenetres, nbFenetres);
  const { bureau, reserve } = useBarreOnglets();
  if (!l.active || l.discret || (!dansFenetre && n > 0)) return null;

  const pastille = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2, paddingLeft: 4, paddingRight: 12, borderRadius: 999, backgroundColor: surfaceHaute(), borderWidth: 1, borderColor: alpha(C.accent, 0.35), ...ombreAvant(C.accent) }}>
      {/* À côté des ondes et non dedans : elles sont cachées aux lecteurs d'écran, pas la pause. */}
      <View style={{ width: 68, height: 68, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute' }}>
          <Ondes mode={l.enPause ? 'repos' : 'parle'} couleur={C.accent} taille={84} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={l.enPause ? 'Reprendre la lecture' : 'Mettre la lecture en pause'}
          hitSlop={12}
          onPress={() => void (l.enPause ? reprendreLecture() : pauseLecture())}
          style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, opacity: pressed ? 0.8 : 1 })}>
          <Icone nom={l.enPause ? 'lecture' : 'pause'} color="#fff" size={18} />
        </Pressable>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>
          {l.titre || 'Lecture à voix haute'}
        </Text>
        <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>
          {l.enPause ? 'En pause' : 'En cours'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Arrêter la lecture"
        hitSlop={8}
        onPress={() => void taire()}
        style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? alpha(C.ink, 0.1) : C.sunk })}>
        <Icone nom="stop" color={C.ink} size={16} />
      </Pressable>
    </View>
  );

  if (dansFenetre) return <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>{pastille}</View>;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom: bureau ? 20 : reserve, zIndex: 40, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 420 }}>{pastille}</View>
    </View>
  );
}
