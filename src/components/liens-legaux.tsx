import * as Linking from 'expo-linking';
import { Platform, Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { C, F } from '@/lib/theme';

/** Sur le web, les pages sont servies avec l'app ; dans l'app installée, il faut l'adresse du site (EXPO_PUBLIC_SITE_URL). */
const SITE = Platform.OS === 'web' ? '' : process.env.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') || null;

export const PAGES_LEGALES = [
  { page: 'confidentialite', label: 'Confidentialité' },
  { page: 'conditions', label: 'Conditions' },
  { page: 'cgv', label: 'Conditions de vente' },
  { page: 'mentions-legales', label: 'Mentions légales' },
] as const;

export const urlLegale = (page: string) => (SITE === null ? null : `${SITE}/${page}`);

/** Confidentialité, conditions, conditions de vente et mentions légales, en petit ; rien si l'adresse du site n'est pas connue. */
export function LiensLegaux({ centre }: { centre?: boolean }) {
  if (SITE === null) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: centre ? 'center' : 'flex-start', columnGap: 14, rowGap: 6, flexWrap: 'wrap' }}>
      {PAGES_LEGALES.map((p) => (
        <Pressable key={p.page} accessibilityRole="link" onPress={() => Linking.openURL(urlLegale(p.page)!)} hitSlop={6}>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12, textDecorationLine: 'underline' }}>{p.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
