import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { surCelebration, type Celebration } from '@/lib/celebration';
import { useBarreOnglets } from '@/lib/mise-en-page';
import { jouer } from '@/lib/sons';
import { alpha, C, F } from '@/lib/theme';

const natif = Platform.OS !== 'web';

/** « +10 pts » (ou un court message) qui monte et s'efface au-dessus de la barre d'onglets. */
function Points({ id, texte, emoji, couleur, duree, onFin }: { id: number; texte: string; emoji: string; couleur: string; duree: number; onFin: (id: number) => void }) {
  const [v] = useState(() => new Animated.Value(0));
  const { haut } = useBarreOnglets();
  useEffect(() => {
    // Seule une animation allée à son terme efface le message (pas celle interrompue par le suivant).
    Animated.timing(v, { toValue: 1, duration: duree, easing: Easing.out(Easing.cubic), useNativeDriver: natif }).start(({ finished }) => finished && onFin(id));
  }, [v, onFin, duree, id]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: haut + 36,
        alignSelf: 'center',
        maxWidth: '90%',
        opacity: v.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, -50] }) }, { scale: v.interpolate({ inputRange: [0, 0.15, 0.3, 1], outputRange: [0.7, 1.12, 1, 1] }) }],
      }}>
      <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: alpha(couleur, 0.5), borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}>
        <Text style={{ fontSize: 16 }}>{emoji}</Text>
        <Text style={{ color: couleur, fontFamily: F.titre, fontSize: texte.length > 12 ? 15 : 18, flexShrink: 1 }}>{texte}</Text>
      </View>
    </Animated.View>
  );
}

/** Pluie de confettis, une fois, de haut en bas. */
function Confettis() {
  const { width, height } = useWindowDimensions();
  const [pieces] = useState(() =>
    Array.from({ length: 36 }, (_, i) => ({
      v: new Animated.Value(0),
      x: Math.random(),
      derive: (Math.random() - 0.5) * 120,
      tour: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360),
      duree: 1600 + Math.random() * 1200,
      delai: Math.random() * 300,
      couleur: [C.accent, C.coach, C.hebdo, C.agressif, C.normal][i % 5],
      w: 6 + Math.random() * 6,
    })),
  );
  useEffect(() => {
    Animated.parallel(pieces.map((p) => Animated.timing(p.v, { toValue: 1, duration: p.duree, delay: p.delai, easing: Easing.in(Easing.quad), useNativeDriver: natif }))).start();
  }, [pieces]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x * width,
            top: -20,
            width: p.w,
            height: p.w * 1.6,
            borderRadius: 2,
            backgroundColor: p.couleur,
            opacity: p.v.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.9] }) },
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.derive] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.tour}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

type Grande = Exclude<Celebration, { type: 'points' } | { type: 'message' }>;
type Petite = { id: number; texte: string; emoji: string; couleur: string; duree: number };

function contenu(c: Grande) {
  if (c.type === 'parfait') return { emoji: '⭐', titre: 'Journée parfaite !', texte: `Toute ta mission du jour est faite. Bonus de ${50} points.` };
  if (c.type === 'niveau') return { emoji: '🚀', titre: `Niveau ${c.niveau}`, texte: `Tu deviens « ${c.titre} ». Continue comme ça.` };
  return { emoji: c.emoji, titre: `Badge : ${c.nom}`, texte: c.desc };
}

/** Écoute les célébrations : petits points pour chaque action, carte et confettis pour les grands moments. */
export function Celebrations() {
  const [points, setPoints] = useState<Petite | null>(null);
  const [file, setFile] = useState<Grande[]>([]);
  const finPoints = useCallback((id: number) => setPoints((p) => (p?.id === id ? null : p)), []);

  useEffect(
    () =>
      surCelebration((c) => {
        if (c.type === 'message') {
          setPoints({ id: Date.now(), texte: c.texte, emoji: c.emoji, couleur: c.alerte ? C.agressif : C.accent, duree: 3200 });
          return;
        }
        if (c.type === 'points' || c.type === 'parfait') {
          setPoints({ id: Date.now(), texte: `+${c.points} pts`, emoji: c.type === 'parfait' ? '⭐' : '✨', couleur: C.coach, duree: 1300 });
          jouer(c.type === 'parfait' ? 'bravo' : 'valide');
        }
        if (c.type !== 'points') setFile((f) => [...f, c]);
      }),
    [],
  );

  const grande = file[0];
  useEffect(() => {
    if (grande && grande.type !== 'parfait') jouer('bravo');
  }, [grande]);
  const c = grande ? contenu(grande) : null;

  return (
    <>
      {points ? <Points key={points.id} id={points.id} texte={points.texte} emoji={points.emoji} couleur={points.couleur} duree={points.duree} onFin={finPoints} /> : null}
      <Modal visible={!!grande} transparent animationType="fade" onRequestClose={() => setFile((f) => f.slice(1))}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {grande ? <Confettis key={file.length} /> : null}
          {c ? (
            <View style={{ width: '100%', maxWidth: 360, backgroundColor: C.surface, borderRadius: 24, padding: 28, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.line }}>
              <Text style={{ fontSize: 56 }}>{c.emoji}</Text>
              <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 24, textAlign: 'center' }}>{c.titre}</Text>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 15, textAlign: 'center', lineHeight: 21 }}>{c.texte}</Text>
              <Pressable accessibilityRole="button" onPress={() => setFile((f) => f.slice(1))} style={({ pressed }) => ({ marginTop: 10, alignSelf: 'stretch', backgroundColor: C.accent, borderRadius: 14, paddingVertical: 13, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}>
                <Text style={{ color: C.accentInk, fontFamily: F.texteF, fontSize: 15 }}>Super !</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
