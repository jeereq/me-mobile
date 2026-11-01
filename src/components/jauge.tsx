import { View } from 'react-native';

import { C } from '@/lib/theme';

/** Vert tant que ça va, ambre à partir de 80 %, rouge au-delà du budget. */
export const couleurRatio = (r: number) => (r > 1 ? C.agressif : r >= 0.8 ? C.hebdo : C.coach);

/**
 * La jauge d'un budget. `repere` (de 0 à 1) pose un trait « aujourd'hui » à la part de la période déjà écoulée :
 * un remplissage qui dépasse le trait veut dire qu'on dépense plus vite que prévu. `couleur` impose la teinte du remplissage.
 */
export function Jauge({ ratio, hauteur = 8, repere, couleur }: { ratio: number; hauteur?: number; repere?: number | null; couleur?: string }) {
  const trait = repere === undefined || repere === null ? null : Math.max(0, Math.min(1, repere));
  return (
    <View
      style={{ height: hauteur, justifyContent: 'center' }}
      accessibilityLabel={`${Math.round(ratio * 100)} % utilisé${trait !== null ? `, ${Math.round(trait * 100)} % de la période écoulée` : ''}`}>
      <View style={{ height: hauteur, borderRadius: hauteur / 2, backgroundColor: C.sunk, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, Math.round(ratio * 100))}%`, height: '100%', borderRadius: hauteur / 2, backgroundColor: couleur ?? couleurRatio(ratio) }} />
      </View>
      {trait !== null && trait > 0 && trait < 1 ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: `${trait * 100}%`, top: -3, bottom: -3, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: C.ink }} />
      ) : null}
    </View>
  );
}
