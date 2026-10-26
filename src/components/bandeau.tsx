import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

import { Icone } from '@/components/icones';
import { LARGEUR_BANDEAU, useZonesSures } from '@/lib/mise-en-page';
import { jouer } from '@/lib/sons';
import { useStore } from '@/lib/store';
import { alpha, C, F, MODE_COLORS } from '@/lib/theme';
import type { Mode } from '@/lib/types';

/** Bandeau en haut de l'écran quand un rappel arrive pendant que l'app est ouverte, avec un son. */
export function Bandeau() {
  const { nouvelle, fermerNouvelle, espace } = useStore();
  const { haut } = useZonesSures();
  const [y] = useState(() => new Animated.Value(-160));
  const visible = !!nouvelle && espace.notifs?.app !== false;

  useEffect(() => {
    if (!visible) return;
    y.setValue(-160);
    jouer('notif');
    Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    const t = setTimeout(() => Animated.timing(y, { toValue: -160, duration: 220, useNativeDriver: true }).start(fermerNouvelle), 7000);
    return () => clearTimeout(t);
  }, [visible, nouvelle?.id, y, fermerNouvelle]);

  if (!visible || !nouvelle) return null;
  const col = MODE_COLORS[nouvelle.mode as Mode] || C.accent;
  return (
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', top: haut + 8, left: 12, right: 12, alignItems: 'center', transform: [{ translateY: y }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Rappel : ${nouvelle.titre}`}
        onPress={() => {
          fermerNouvelle();
          router.push('/notifications');
        }}
        style={{ width: '100%', maxWidth: LARGEUR_BANDEAU, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: alpha(col, 0.5), shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 16 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: alpha(col, 0.15), alignItems: 'center', justifyContent: 'center' }}>
          <Icone nom="cloche" color={col} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>
            {nouvelle.titre}
          </Text>
          {nouvelle.corps ? (
            <Text numberOfLines={2} style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
              {nouvelle.corps}
            </Text>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={10} onPress={fermerNouvelle}>
          <Text style={{ color: C.muted, fontSize: 18 }}>×</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
