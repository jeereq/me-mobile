import { Tabs } from 'expo-router/js-tabs';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { addDays, doneIn, habitToday, today } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

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

export default function TabsLayout() {
  const { espace } = useStore();
  const d = today();
  const soon = addDays(d, 2);
  const rel = espace.relances.filter((r) => r.statut === 'a_faire' && r.date <= d).length;
  const tac = espace.taches.filter((t) => t.statut !== 'fait' && (t.priorite === 'haute' || (t.echeance && t.echeance <= soon))).length;
  const hab = espace.habitudes.filter((h) => habitToday(h, d) && !doneIn(h, d)).length;
  const badge = (n: number) => (n ? n : undefined);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: '#03070A', borderTopColor: C.line, height: 84, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarBadgeStyle: { backgroundColor: C.accent, color: C.accentInk, fontSize: 11 },
        sceneStyle: { backgroundColor: C.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: "Aujourd'hui", tabBarIcon: ({ color }) => <Icon name="jour" color={color} /> }} />
      <Tabs.Screen name="relances" options={{ title: 'Relances', tabBarBadge: badge(rel), tabBarIcon: ({ color }) => <Icon name="relances" color={color} /> }} />
      <Tabs.Screen name="taches" options={{ title: 'Tâches', tabBarBadge: badge(tac), tabBarIcon: ({ color }) => <Icon name="taches" color={color} /> }} />
      <Tabs.Screen name="habitudes" options={{ title: 'Habitudes', tabBarBadge: badge(hab), tabBarIcon: ({ color }) => <Icon name="habitudes" color={color} /> }} />
      <Tabs.Screen name="plus" options={{ title: 'Plus', tabBarIcon: ({ color }) => <Icon name="plus" color={color} /> }} />
    </Tabs>
  );
}
