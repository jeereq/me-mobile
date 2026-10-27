import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LARGEUR_DIALOGUE, useBarreOnglets, useZonesSures } from '@/lib/mise-en-page';
import { C, F } from '@/lib/theme';
import type { Finances } from '@/lib/types';

/** Une suppression qu'on peut encore défaire : ce qu'elle dit, et comment remettre ce qui a été retiré. */
export type Annulable = { texte: string; restaurer: (g: Finances) => Finances };

const Contexte = createContext<(a: Annulable) => void>(() => {});

/** Les fenêtres des finances signalent ici chaque suppression ; l'écran affiche « Annuler » quelques secondes. */
export const AnnulerFinances = Contexte.Provider;
export const useSignalerSuppression = () => useContext(Contexte);

/** L'état de la barre « Supprimé · Annuler » : la dernière suppression, oubliée au bout de 6 secondes. */
export function useAnnulation(setF: (fn: (f: Finances) => Finances) => void) {
  const [courant, setCourant] = useState<(Annulable & { n: number }) | null>(null);
  const signaler = useCallback((a: Annulable) => setCourant((x) => ({ ...a, n: (x?.n ?? 0) + 1 })), []);
  useEffect(() => {
    if (!courant) return;
    const t = setTimeout(() => setCourant(null), 6000);
    return () => clearTimeout(t);
  }, [courant]);
  const annuler = () => {
    if (!courant) return;
    setF(courant.restaurer);
    setCourant(null);
  };
  return { signaler, texte: courant?.texte ?? null, annuler, fermer: () => setCourant(null) };
}

/** Barre flottante en bas de l'écran : « Dépense supprimée · Annuler ». */
export function BarreAnnuler({ texte, annuler, fermer }: { texte: string | null; annuler: () => void; fermer: () => void }) {
  const barre = useBarreOnglets();
  const { bas } = useZonesSures();
  if (!texte) return null;
  return (
    <View style={{ position: 'absolute', left: 12, right: 12, bottom: barre.bureau ? 24 : Math.max(bas, 12) + 8, alignItems: 'center', zIndex: 20 }}>
      <View style={{ width: '100%', maxWidth: LARGEUR_DIALOGUE, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
        <Text accessibilityLiveRegion="polite" numberOfLines={2} style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
          {texte}
        </Text>
        <Pressable accessibilityRole="button" onPress={annuler} hitSlop={8}>
          <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 14 }}>Annuler</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={fermer} hitSlop={8}>
          <Text style={{ color: C.muted, fontSize: 16 }}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}
