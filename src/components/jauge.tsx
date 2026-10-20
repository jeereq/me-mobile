import { View } from 'react-native';

import { C } from '@/lib/theme';

/** Vert tant que ça va, ambre à partir de 80 %, rouge au-delà du budget. */
export const couleurRatio = (r: number) => (r > 1 ? C.agressif : r >= 0.8 ? C.hebdo : C.coach);

export function Jauge({ ratio, hauteur = 8 }: { ratio: number; hauteur?: number }) {
  return (
    <View style={{ height: hauteur, borderRadius: hauteur / 2, backgroundColor: C.sunk, overflow: 'hidden' }} accessibilityLabel={`${Math.round(ratio * 100)} % utilisé`}>
      <View style={{ width: `${Math.min(100, Math.round(ratio * 100))}%`, height: '100%', borderRadius: hauteur / 2, backgroundColor: couleurRatio(ratio) }} />
    </View>
  );
}
