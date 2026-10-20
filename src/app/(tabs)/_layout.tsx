import { Tabs } from 'expo-router/js-tabs';
import { useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { addDays, doneIn, habitToday, today } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { useThemeCle } from '@/lib/theme-cle';

type IconName = 'jour' | 'relances' | 'taches' | 'habitudes' | 'plus';

function Icon({ name, color: c }: { name: IconName; color: unknown }) {
  const color = typeof c === "string" ? c : C.muted;
  const p = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
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
  );
}

/** À partir de cette largeur (ordinateur, tablette en paysage), les onglets passent en barre latérale. */
export const LARGEUR_BUREAU = 900;

// La clé du thème fait recalculer les couleurs de la barre d'onglets.
const optionsTabs = (_cle: string, bureau: boolean) => ({
  headerShown: false,
  tabBarActiveTintColor: C.accent,
  tabBarInactiveTintColor: C.muted,
  ...(bureau
    ? {
        tabBarPosition: 'left' as const,
        tabBarVariant: 'material' as const,
        tabBarLabelPosition: 'beside-icon' as const,
        tabBarActiveBackgroundColor: C.accentSoft,
        tabBarStyle: { backgroundColor: C.surface, borderRightColor: C.line, width: 220, paddingTop: 24 },
        tabBarItemStyle: { borderRadius: 12, marginHorizontal: 12, marginVertical: 2, justifyContent: 'flex-start' as const, paddingLeft: 12 },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' as const, marginLeft: 12 },
      }
    : {
        tabBarStyle: { backgroundColor: C.tabBg, borderTopColor: C.line, height: 84, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
      }),
  tabBarBadgeStyle: { backgroundColor: C.accent, color: C.accentInk, fontSize: 11 },
  sceneStyle: { backgroundColor: C.bg },
});

export default function TabsLayout() {
  const { espace } = useStore();
  const cle = useThemeCle();
  const bureau = useWindowDimensions().width >= LARGEUR_BUREAU;
  const d = today();
  const soon = addDays(d, 2);
  const rel = espace.relances.filter((r) => r.statut === 'a_faire' && r.date <= d).length;
  const tac = espace.taches.filter((t) => t.statut !== 'fait' && (t.priorite === 'haute' || (t.echeance && t.echeance <= soon))).length;
  const hab = espace.habitudes.filter((h) => habitToday(h, d) && !doneIn(h, d)).length;
  const badge = (n: number) => (n ? n : undefined);
  return (
    <Tabs screenOptions={optionsTabs(cle, bureau)}>
      <Tabs.Screen name="index" options={{ title: "Aujourd'hui", tabBarIcon: ({ color }) => <Icon name="jour" color={color} /> }} />
      <Tabs.Screen name="relances" options={{ title: 'Relances', tabBarBadge: badge(rel), tabBarIcon: ({ color }) => <Icon name="relances" color={color} /> }} />
      <Tabs.Screen name="taches" options={{ title: 'Tâches', tabBarBadge: badge(tac), tabBarIcon: ({ color }) => <Icon name="taches" color={color} /> }} />
      <Tabs.Screen name="habitudes" options={{ title: 'Habitudes', tabBarBadge: badge(hab), tabBarIcon: ({ color }) => <Icon name="habitudes" color={color} /> }} />
      <Tabs.Screen name="plus" options={{ title: 'Plus', tabBarIcon: ({ color }) => <Icon name="plus" color={color} /> }} />
    </Tabs>
  );
}
