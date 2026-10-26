import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { LARGEUR_BANDEAU, useBarreOnglets } from '@/lib/mise-en-page';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

const navigateurEnLigne = () => Platform.OS !== 'web' || typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * Pastille au-dessus de la barre d'onglets et du bouton + quand le serveur est injoignable : les changements restent sur l'appareil
 * et repartent seuls au retour du réseau (voir `reessayer` dans le store).
 */
export function HorsLigne() {
  const { syncState, reessayer } = useStore();
  const { haut } = useBarreOnglets();
  const [enLigne, setEnLigne] = useState(navigateurEnLigne);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const maj = () => setEnLigne(navigateurEnLigne());
    window.addEventListener('online', maj);
    window.addEventListener('offline', maj);
    return () => {
      window.removeEventListener('online', maj);
      window.removeEventListener('offline', maj);
    };
  }, []);

  if (enLigne && syncState !== 'erreur') return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom: haut + 84, alignItems: 'center' }}>
      <View
        accessibilityRole="alert"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: LARGEUR_BANDEAU, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: alpha(C.hebdo, 0.5), shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.hebdo }} />
        <Text style={{ flexShrink: 1, color: C.ink, fontFamily: F.texte, fontSize: 13 }}>
          {enLigne ? 'Synchronisation impossible.' : 'Hors ligne.'} Tes changements sont gardés sur cet appareil et partiront au retour du réseau.
        </Text>
        {enLigne && syncState === 'erreur' ? (
          <Pressable accessibilityRole="button" onPress={reessayer} hitSlop={8}>
            <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Réessayer</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
