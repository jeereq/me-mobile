import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { chargementsEnCours, surChargement } from '@/lib/chargement';
import { useZonesSures } from '@/lib/mise-en-page';
import { C } from '@/lib/theme';

// Sous ce délai, rien ne s'affiche : un chargement éclair ne fait pas clignoter l'écran.
const DELAI = 150;

/** Fine barre en haut de l'écran pendant qu'un chargement est en cours : elle avance, puis se remplit et s'efface à la fin. */
export function BarreChargement() {
  const { haut } = useZonesSures();
  const [actif, setActif] = useState(() => chargementsEnCours() > 0);
  const [p] = useState(() => new Animated.Value(0));
  const [o] = useState(() => new Animated.Value(0));
  const visible = useRef(false);

  useEffect(() => surChargement((n) => setActif(n > 0)), []);

  useEffect(() => {
    if (actif) {
      // Un chargement qui en enchaîne un autre continue la même barre.
      if (visible.current) return;
      const t = setTimeout(() => {
        visible.current = true;
        p.stopAnimation();
        o.stopAnimation();
        p.setValue(0);
        o.setValue(1);
        Animated.sequence([
          Animated.timing(p, { toValue: 0.3, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(p, { toValue: 0.9, duration: 12000, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        ]).start();
      }, DELAI);
      return () => clearTimeout(t);
    }
    if (!visible.current) return;
    const t = setTimeout(() => {
      visible.current = false;
      p.stopAnimation();
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(o, { toValue: 0, duration: 250, useNativeDriver: false }),
      ]).start();
    }, DELAI);
    return () => clearTimeout(t);
  }, [actif, p, o]);

  return (
    <View
      pointerEvents="none"
      accessibilityRole="progressbar"
      accessibilityLabel={actif ? 'Chargement en cours' : undefined}
      aria-busy={actif}
      style={{ position: 'absolute', top: haut, left: 0, right: 0, height: 3, zIndex: 1000 }}>
      <Animated.View
        style={{
          height: '100%',
          width: p.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          opacity: o,
          backgroundColor: C.accent,
          borderTopRightRadius: 2,
          borderBottomRightRadius: 2,
          shadowColor: C.accent,
          shadowOpacity: 0.6,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
    </View>
  );
}
