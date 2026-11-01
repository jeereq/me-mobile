import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { addDays, doneIn, habitToday, today } from '@/lib/dates';
import { HAUTEUR_BARRE, useBarreOnglets } from '@/lib/mise-en-page';
import { tachesUrgentes } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { tap } from '@/components/ui';
import { alpha, C, F } from '@/lib/theme';
import { teinte, teinteDe } from '@/lib/teinte';
import { useThemeCle } from '@/lib/theme-cle';
import { relanceAttendue } from '@/lib/suivi';

type IconName = 'jour' | 'relances' | 'taches' | 'habitudes' | 'finances' | 'plus';

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
        {name === 'finances' && <Path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3M4 7.5V17a2 2 0 0 0 2 2h13V8H6.5A2.5 2.5 0 0 1 4 7.5zM15.5 13.5h.01" {...p} />}
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

/**
 * Bouton du milieu de la barre : noter une dépense en un geste, d'où que l'on soit. Il ouvre Finances avec la
 * fenêtre de saisie déjà ouverte (une valeur nouvelle à chaque appui, pour la rouvrir même si l'on y est déjà).
 */
function BoutonDepense() {
  const c = teinteDe('/finances');
  const signe = teinte(c).encre;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajouter une dépense"
      onPress={() => {
        tap();
        router.navigate(`/finances?ajout=${Date.now()}`);
      }}
      style={({ pressed }) => [{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}>
      <View style={{ width: 48, height: 30, borderRadius: 15, backgroundColor: c, alignItems: 'center', justifyContent: 'center', shadowColor: c, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path d="M12 5v14M5 12h14" stroke={signe} strokeWidth={2.4} strokeLinecap="round" />
        </Svg>
      </View>
      <Text numberOfLines={1} style={{ color: c, fontSize: 10, fontFamily: F.texteF, letterSpacing: -0.1 }}>
        Dépense
      </Text>
    </Pressable>
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
  const rel = espace.relances.filter((r) => relanceAttendue(r) && r.date <= d).length;
  const tac = tachesUrgentes(espace, d, soon).length;
  const hab = espace.habitudes.filter((h) => habitToday(h, d) && !doneIn(h, d)).length;
  const badge = (n: number) => (n ? n : undefined);
  // Sur téléphone, la barre met les finances en avant : Accueil, À faire, Dépense (bouton du milieu), Finances, Plus.
  // « À faire » réunit les tâches et les relances (avec leurs deux nombres) ; Habitudes reste en tête de « Plus ».
  return (
    <Tabs
      screenOptions={optionsTabs(cle, bureau, decalage)}
      // Sur ordinateur, la barre latérale de l'app (dans le layout racine) remplace la barre d'onglets.
      tabBar={bureau ? () => null : undefined}>
      <Tabs.Screen name="index" options={{ tabBarActiveTintColor: teinteDe('/'), title: "Aujourd'hui", tabBarLabel: bureau ? "Aujourd'hui" : 'Accueil', tabBarIcon: ({ color, focused }) => <Icon name="jour" color={color} actif={focused && !bureau} /> }} />
      <Tabs.Screen name="taches" options={{ tabBarActiveTintColor: teinteDe('/taches'), title: bureau ? 'Tâches' : 'À faire', tabBarBadge: badge(bureau ? tac : tac + rel), tabBarIcon: ({ color, focused }) => <Icon name="taches" color={color} actif={focused && !bureau} /> }} />
      <Tabs.Screen name="ajouter" options={{ title: 'Ajouter une dépense', tabBarButton: () => <BoutonDepense /> }} />
      <Tabs.Screen name="finances" options={{ tabBarActiveTintColor: teinteDe('/finances'), title: 'Finances', tabBarIcon: ({ color, focused }) => <Icon name="finances" color={color} actif={focused && !bureau} /> }} />
      <Tabs.Screen name="plus" options={{ tabBarActiveTintColor: teinteDe('/plus'), title: 'Plus', tabBarBadge: badge(hab), tabBarIcon: ({ color, focused }) => <Icon name="plus" color={color} actif={focused && !bureau} /> }} />
      {/* Sans bouton dans la barre, mais toujours ouvrables (`href: null` les rendrait inaccessibles et redirigerait). */}
      <Tabs.Screen name="relances" options={{ title: 'Relances', tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="habitudes" options={{ title: 'Habitudes', tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
}
