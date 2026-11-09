import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { allerLecture, changerVitesseLecture, etatLecture, pauseLecture, reprendreLecture, surLecture, taire } from '@/lib/assistant';
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

const VITESSE = (v?: number) => `${String(v ?? 1).replace('.', ',')}×`;

/**
 * Le lecteur, tant que l'app lit quelque chose à voix haute, sur tous les écrans : la phrase en cours, où on en est,
 * pause, phrase précédente ou suivante, vitesse, arrêt.
 */
export function BarreLecture({ dansFenetre }: { dansFenetre?: boolean }) {
  const l = useSyncExternalStore(surLecture, etatLecture, etatLecture);
  const n = useSyncExternalStore(surFenetres, nbFenetres, nbFenetres);
  const { bureau, reserve } = useBarreOnglets();
  if (!l.active || l.discret || (!dansFenetre && n > 0)) return null;

  const total = l.total ?? 0;
  const numero = l.numero ?? 0;
  const part = total ? Math.max(3, Math.round((numero / total) * 100)) : 0;
  const petit = (icone: 'precedent' | 'suivant', label: string, delta: number, off: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={off} hitSlop={6} onPress={() => allerLecture(delta)} style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? alpha(C.ink, 0.1) : C.sunk, opacity: off ? 0.4 : 1 })}>
      <Icone nom={icone} color={C.ink} size={16} />
    </Pressable>
  );

  const carte = (
    <View style={{ gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 22, backgroundColor: surfaceHaute(), borderWidth: 1, borderColor: alpha(C.accent, 0.35), ...ombreAvant(C.accent) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* À côté des ondes et non dedans : elles sont cachées aux lecteurs d'écran, pas la pause. */}
        <View style={{ width: 62, height: 62, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute' }}>
            <Ondes mode={l.enPause ? 'repos' : 'parle'} couleur={C.accent} taille={78} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={l.enPause ? 'Reprendre la lecture' : 'Mettre la lecture en pause'}
            hitSlop={12}
            onPress={() => void (l.enPause ? reprendreLecture() : pauseLecture())}
            style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, opacity: pressed ? 0.8 : 1 })}>
            <Icone nom={l.enPause ? 'lecture' : 'pause'} color="#fff" size={17} />
          </Pressable>
        </View>
        <View accessibilityLiveRegion="none" style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 13.5 }}>
            {l.titre || 'Lecture à voix haute'}
          </Text>
          <Text numberOfLines={2} style={{ color: l.enPause ? C.muted : C.ink, fontFamily: F.texte, fontSize: 13, lineHeight: 17 }}>
            {l.enPause ? `En pause : ${l.phrase ?? ''}` : l.phrase}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Arrêter la lecture"
          hitSlop={8}
          onPress={() => void taire()}
          style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? alpha(C.ink, 0.1) : C.sunk })}>
          <Icone nom="stop" color={C.ink} size={14} />
        </Pressable>
      </View>
      {total > 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {petit('precedent', 'Phrase précédente', -1, numero <= 1)}
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: numero }} style={{ flex: 1, gap: 2 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: C.sunk, overflow: 'hidden' }}>
              <View style={{ width: `${part}%`, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
            </View>
          </View>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{`${numero}/${total}`}</Text>
          {petit('suivant', 'Phrase suivante', 1, numero >= total)}
          <Pressable accessibilityRole="button" accessibilityLabel={`Vitesse ${VITESSE(l.vitesse)}. Changer`} hitSlop={6} onPress={changerVitesseLecture} style={({ pressed }) => ({ minWidth: 44, height: 34, paddingHorizontal: 8, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? alpha(C.ink, 0.1) : C.sunk })}>
            <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 12.5 }}>{VITESSE(l.vitesse)}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  if (dansFenetre) return <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>{carte}</View>;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: bureau ? 12 : 76, bottom: bureau ? 20 : reserve, zIndex: 40, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 480 }}>{carte}</View>
    </View>
  );
}
