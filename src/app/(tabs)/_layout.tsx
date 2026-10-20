import { BottomTabBar, Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { addDays, doneIn, habitToday, today } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';
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
        tabBarStyle: { backgroundColor: 'transparent', borderRightWidth: 0, width: 232, paddingTop: 0 },
        tabBarItemStyle: { borderRadius: 12, marginHorizontal: 12, marginVertical: 2, justifyContent: 'flex-start' as const, paddingLeft: 12 },
        tabBarLabelStyle: { fontSize: 14, fontFamily: F.texteF, marginLeft: 12 },
      }
    : {
        // Barre flottante arrondie, détachée du bas de l'écran.
        tabBarStyle: {
          position: 'absolute' as const,
          left: 12,
          right: 12,
          bottom: 14,
          height: 68,
          paddingTop: 6,
          paddingBottom: 8,
          borderRadius: 24,
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: C.line,
          borderTopColor: C.line,
          backgroundColor: C.tabBg,
          shadowColor: '#000',
          shadowOpacity: C.sombre ? 0.5 : 0.12,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        },
        tabBarItemStyle: { borderRadius: 18, paddingHorizontal: 0 },
        tabBarActiveBackgroundColor: C.accentSoft,
        tabBarLabelStyle: { fontSize: 10, fontFamily: F.texteF, letterSpacing: -0.1 },
      }),
  tabBarBadgeStyle: { backgroundColor: C.accent, color: C.accentInk, fontSize: 11 },
  sceneStyle: { backgroundColor: C.bg },
});

/** Barre latérale de la version ordinateur : la marque en haut, les onglets, puis le compte en bas. */
function BarreLaterale(props: BottomTabBarProps & { nom: string; detail: string }) {
  const { nom, detail, ...barre } = props;
  return (
    <View style={{ width: 232, backgroundColor: C.surface, borderRightWidth: 1, borderRightColor: C.line, paddingVertical: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, marginBottom: 18 }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.accentInk, fontFamily: F.titre, fontSize: 15 }}>me</Text>
        </View>
        <View>
          <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 17 }}>me</Text>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>Assistant perso</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <BottomTabBar {...barre} />
      </View>
      <View style={{ marginHorizontal: 12, padding: 12, borderRadius: 12, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>
          {nom}
        </Text>
        <Text numberOfLines={1} style={{ color: C.muted, fontSize: 12 }}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { espace, profil, mode, isAdmin } = useStore();
  const cle = useThemeCle();
  const bureau = useWindowDimensions().width >= LARGEUR_BUREAU;
  const d = today();
  const soon = addDays(d, 2);
  const rel = espace.relances.filter((r) => r.statut === 'a_faire' && r.date <= d).length;
  const tac = espace.taches.filter((t) => t.statut !== 'fait' && (t.priorite === 'haute' || (t.echeance && t.echeance <= soon))).length;
  const hab = espace.habitudes.filter((h) => habitToday(h, d) && !doneIn(h, d)).length;
  const badge = (n: number) => (n ? n : undefined);
  return (
    <Tabs
      screenOptions={optionsTabs(cle, bureau)}
      tabBar={bureau ? (props) => <BarreLaterale {...props} nom={mode === 'cloud' ? profil?.nom || profil?.email || 'Mon compte' : 'Mode local'} detail={mode === 'cloud' ? (isAdmin ? 'Admin' : 'Utilisateur') : 'Données sur cet appareil'} /> : undefined}>
      <Tabs.Screen name="index" options={{ title: "Aujourd'hui", tabBarIcon: ({ color }) => <Icon name="jour" color={color} /> }} />
      <Tabs.Screen name="relances" options={{ title: 'Relances', tabBarBadge: badge(rel), tabBarIcon: ({ color }) => <Icon name="relances" color={color} /> }} />
      <Tabs.Screen name="taches" options={{ title: 'Tâches', tabBarBadge: badge(tac), tabBarIcon: ({ color }) => <Icon name="taches" color={color} /> }} />
      <Tabs.Screen name="habitudes" options={{ title: 'Habitudes', tabBarBadge: badge(hab), tabBarIcon: ({ color }) => <Icon name="habitudes" color={color} /> }} />
      <Tabs.Screen name="plus" options={{ title: 'Plus', tabBarIcon: ({ color }) => <Icon name="plus" color={color} /> }} />
    </Tabs>
  );
}
