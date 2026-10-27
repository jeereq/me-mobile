import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { ouvrirVoix } from '@/lib/ecoute';
import { C } from '@/lib/theme';

/**
 * Lien me://voix (ou /voix sur le web) : ouvre la commande vocale par-dessus l'accueil.
 * À brancher sur un raccourci Siri (« Ouvrir l'URL ») ou un raccourci Android pour parler à l'app sans la toucher.
 */
export default function LienVoix() {
  useEffect(() => {
    router.replace('/');
    ouvrirVoix();
  }, []);
  return <View style={{ flex: 1, backgroundColor: C.bg }} />;
}
