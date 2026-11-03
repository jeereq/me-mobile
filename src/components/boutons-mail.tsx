import { useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { Text } from '@/components/texte';

import { parler, taire } from '@/lib/assistant';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { Icone, type IconeNom } from './icones';

/** Un petit bouton à icône, le même pour écouter, dicter et faire relire. */
export function BoutonMail({ icone, label, actif, disabled, onPress }: { icone: IconeNom; label: string; actif?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: actif ? C.accent : C.line, backgroundColor: actif ? alpha(C.accent, 0.14) : pressed ? alpha(C.ink, 0.06) : C.sunk, opacity: disabled ? 0.6 : 1 })}>
      <Icone nom={icone} color={actif ? C.accent : C.ink} size={15} />
      <Text style={{ color: actif ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/** Faire lire un texte à voix haute depuis un bouton : la lecture s'arrête avec le bouton, ou quand une autre commence. */
export function useEcoute() {
  const { espace } = useStore();
  const [parle, setParle] = useState(false);
  const mien = useRef(false);
  useEffect(
    () => () => {
      if (mien.current) taire();
    },
    [],
  );
  const lire = (texte: string, titre: string, langue?: string) => {
    mien.current = true;
    setParle(true);
    parler(texte, espace.audio, {
      titre,
      langue,
      onDone: () => {
        mien.current = false;
        setParle(false);
      },
    });
  };
  return { parle, lire, arreter: () => void taire() };
}
