import { LARGEUR_PUBLIQUE } from '@/components/entete-public';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Cadre, GrandTitre } from '@/components/cotisations-ui';
import { Btn, T } from '@/components/ui';
import { C } from '@/lib/theme';

/** Un ancien lien de collecte (/c/...). Le paiement sans compte n'existe plus : tout passe par les groupes. */
export function PageCotisation() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', paddingVertical: 16 }}>
      <View style={{ width: LARGEUR_PUBLIQUE, maxWidth: 420 }}>
        <Cadre>
          <GrandTitre>Ce lien n’est plus valable</GrandTitre>
          <T muted>Demande une invitation à l’organisateur.</T>
          <Btn label="Ouvrir Me" onPress={() => router.replace('/')} />
        </Cadre>
      </View>
    </View>
  );
}
