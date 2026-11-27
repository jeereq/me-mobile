import { Pressable } from 'react-native';
import { usePathname } from 'expo-router';

import { Text } from '@/components/texte';
import { aide, useAide } from '@/lib/guide-aide';
import { guideDeChemin, type GuideCle } from '@/lib/guide-pages';
import { page } from '@/lib/navigation';
import { alpha, C, F } from '@/lib/theme';

const titreDe = (cle: GuideCle) => (cle === 'annuaire' ? 'Annuaire' : page(cle).titre);

/** Le « ? » de l'en-tête. Fichier à part : ui.tsx l'importe, il ne doit pas dépendre de ui.tsx. */
export function BoutonAide() {
  const { actif } = useAide();
  const chemin = usePathname();
  const cle = guideDeChemin(chemin);
  if (!actif || !cle) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Aide : ce qu’on peut faire sur ${titreDe(cle)}`}
      hitSlop={8}
      onPress={() => aide.ouvrir(cle)}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? alpha(C.ink, 0.08) : 'transparent' })}>
      <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 15 }}>?</Text>
    </Pressable>
  );
}

