import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { addDays, doneIn, habitToday, today } from '@/lib/dates';
import { HAUTEUR_BARRE, useBarreOnglets } from '@/lib/mise-en-page';
import { tachesUrgentes } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import { teinteDe } from '@/lib/teinte';
import { useThemeCle } from '@/lib/theme-cle';

type IconName = 'jour' | 'relances' | 'taches' | 'habitudes' | 'plus';

function Icon({ name, color: c, actif }: { name: IconName; color: unknown; actif?: boolean }) {
  const color = typeof c === 'string' ? c : C.muted;
  const p = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  // Onglet actif sur téléphone : une pastille derrière l'icône, comme sur Android et iOS récents.
  return (
    <View style={{ width: 54, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: actif ? alpha(color, C.sombre ? 0.18 : 0.12) : 'transparent', transform: [{ scale: actif ? 1.06 : 1 }] }}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        {name === 'jour' && (
          <>
            <Circle cx="12" cy="12" r="8.5" {...p} />
            <Circle cx="12" cy="12" r="3.5" {...p} />
          </>
        )}
        {name === 'relances' && <Path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4" {...p} />}
        {name === 'taches' && (
          <>
            <Rect x="4" y="4" width="16" height="16" rx="3" {...p} />
            <Path d="M8 12l3 3 5-6" {...p} />
          </>
        )}
        {name === 'habitudes' && <Path d="M4 17l5-5 4 4 7-8M15 8h5v5" {...p} />}
        {name === 'plus' && (
          <>
            <Circle cx="6" cy="12" r="1.6" fill={color} />
            <Circle cx="12" cy="12" r="1.6" fill={color} />
            <Circle cx="18" cy="12" r="1.6" fill={color} />
          </>
        )}
      </Svg>
    </View>
  );
}

// La clé du thème fait recalculer les couleurs de la barre d'onglets.
const optionsTabs = (_cle: string, bureau: boolean, decalage: number) => ({
  headerShown: false,
  tabBarActiveTintColor: C.accent,
  tabBarInactiveTintColor: C.muted,
  ...(bureau
    ? {}
    : {
        // Barre flottante arrondie, détachée du bas de l'écran.
        tabBarStyle: {
          position: 'absolute' as const,
          left: 12,
          right: 12,
          bottom: decalage,
          height: HAUTEUR_BARRE,
          // La barre flotte au-dessus de la zone sûre : pas de rembourrage pour le geste d'accueil à l'intérieur.
          paddingTop: 0,
          paddingBottom: 0,
          paddingHorizontal: 4,
          borderRadius: 22,
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: C.line,
          borderTopColor: C.line,
          backgroundColor: C.surface,
          // Au-dessus du contenu qui défile (les cartes animées créent leur propre couche).
          zIndex: 10,
          shadowColor: '#000',
          shadowOpacity: C.sombre ? 0.5 : 0.12,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        },
        tabBarItemStyle: { paddingHorizontal: 0, paddingVertical: 6 },
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 10, fontFamily: F.texteF, letterSpacing: -0.1 },
      }),
  tabBarBadgeStyle: { backgroundColor: C.agressif, color: '#FFFFFF', fontSize: 11 },
  sceneStyle: { backgroundColor: C.bg },
});

export default function TabsLayout() {
  const { espace } = useStore();
  const cle = useThemeCle();
  const { bureau, decalage } = useBarreOnglets();
  const d = today();
  const soon = addDays(d, 2);
  const rel = espace.relances.filter((r) => r.statut === 'a_faire' && r.date <= d).length;
  const tac = tachesUrgentes(espace, d, soon).length;
  const hab = espace.habitudes.filter((h) => habitToday(h, d) && !doneIn(h, d)).length;
  const badge = (n: number) => (n ? n : undefined);
  return (
    <Tabs
      screenOptions={optionsTabs(cle, bureau, decalage)}
      // Sur ordinateur, la barre latérale de l'app (dans le layout racine) remplace la barre d'onglets.
      tabBar={bureau ? () => null : undefined}>
      <Tabs.Screen name="index" options={{ tabBarActiveTintColor: teinteDe('/'), title: "Aujourd'hui", tabBarLabel: bureau ? "Aujourd'hui" : 'Accueil', tabBarIcon: ({ color, focused }) => <Icon name="jour" color={color} actif={focused && !bureau} /> }} />
      <Tabs.Screen name="relances" options={{ tabBarActiveTintColor: teinteDe('/relances'), title: 'Relances', tabBarBadge: badge(rel), tabBarIcon: ({ color, focused }) => <Icon name="relances" color={color} actif={focused && !bureau} /> }} />
      <Tabs.Screen name="taches" options={{ tabBarActiveTintColor: teinteDe('/taches'), title: 'Tâches', tabBarBadge: badge(tac), tabBarIcon: ({ color, focused }) => <Icon name="taches" color={color} actif={focused && !bureau} /> }} />
      <Tabs.Screen name="habitudes" options={{ tabBarActiveTintColor: teinteDe('/habitudes'), title: 'Habitudes', tabBarBadge: badge(hab), tabBarIcon: ({ color, focused }) => <Icon name="habitudes" color={color} actif={focused && !bureau} /> }} />
      <Tabs.Screen name="plus" options={{ tabBarActiveTintColor: teinteDe('/plus'), title: 'Plus', tabBarIcon: ({ color, focused }) => <Icon name="plus" color={color} actif={focused && !bureau} /> }} />
    </Tabs>
  );
}
