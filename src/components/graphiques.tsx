import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { alpha, C, F } from '@/lib/theme';

export type Point = { cle: string; axe: string; detail: string; v: number };

/**
 * Barres verticales d'une seule série : une couleur, bouts arrondis posés sur la ligne de base.
 * La dernière barre (période en cours) est mise en avant ; toucher une barre affiche sa valeur au-dessus.
 */
export function Barres({ points, hauteur = 110 }: { points: Point[]; hauteur?: number }) {
  const [choisi, setChoisi] = useState(points.length - 1);
  const max = Math.max(1, ...points.map((p) => p.v));
  // Une étiquette sur deux ou trois quand les barres sont nombreuses, toujours sur la plus récente.
  const pas = points.length > 8 ? 3 : 1;
  const n = points.length;
  const p = points[Math.min(choisi, points.length - 1)];
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityLiveRegion="polite" style={{ color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>
        {p?.detail}
      </Text>
      <View style={{ height: hauteur, flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderBottomWidth: 1, borderBottomColor: C.line }}>
        {points.map((x, i) => (
          <Pressable key={x.cle} accessibilityRole="button" accessibilityLabel={x.detail} onPress={() => setChoisi(i)} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
            <View style={{ height: x.v ? Math.max(4, (x.v / max) * (hauteur - 4)) : 2, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: i === choisi ? C.accent : x.v ? alpha(C.accent, 0.4) : C.line }} />
          </Pressable>
        ))}
      </View>
      <View style={{ height: 14 }}>
        {points.map((x, i) =>
          (n - 1 - i) % pas === 0 ? (
            <Text key={x.cle} numberOfLines={1} style={{ position: 'absolute', left: `${((i + 0.5) / n) * 100}%`, width: 64, marginLeft: -32, textAlign: 'center', color: i === choisi ? C.ink : C.muted, fontFamily: F.texte, fontSize: 11 }}>
              {x.axe}
            </Text>
          ) : null,
        )}
      </View>
    </View>
  );
}

/** Barre horizontale avec son libellé et sa valeur, pour comparer des parts (une seule couleur). */
export function Part({ libelle, valeur, ratio }: { libelle: string; valeur: string; ratio: number }) {
  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
          {libelle}
        </Text>
        <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>{valeur}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.sunk, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%`, height: '100%', borderRadius: 3, backgroundColor: C.accent }} />
      </View>
    </View>
  );
}

/** Chiffre clé avec son évolution par rapport à la période précédente. */
export function Tuile({ titre, valeur, evolution, emoji }: { titre: string; valeur: string; evolution?: string; emoji: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', minWidth: 140, backgroundColor: C.sunk, borderRadius: 14, padding: 12, gap: 2 }}>
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 24 }}>{valeur}</Text>
      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{titre}</Text>
      {evolution ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 11, marginTop: 2 }}>{evolution}</Text> : null}
    </View>
  );
}
