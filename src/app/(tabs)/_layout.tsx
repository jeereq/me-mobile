import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, Pressable, View } from 'react-native';
import { useClavier } from '@/components/clavier';
import { Icone } from '@/components/icones';
import { teinteCopilote } from '@/components/copilote';
import { Ondes } from '@/components/ondes';
import { Text, useEchelleTexte } from '@/components/texte';
import { enParole, surParole, taire } from '@/lib/assistant';
import { ouvrirVoix } from '@/lib/ecoute';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { today } from '@/lib/dates';
import { HAUTEUR_BARRE, useBarreOnglets } from '@/lib/mise-en-page';
import { ajoutDeVue, compteursDuJour, page, pagesMasquees, type ClePage } from '@/lib/navigation';
import { useStore } from '@/lib/store';
import { tap } from '@/components/ui';
import { alpha, C, F, ligneHaute, surfaceHaute } from '@/lib/theme';
import { teinte, teinteDe } from '@/lib/teinte';
import { useThemeCle } from '@/lib/theme-cle';

type IconName = 'jour' | 'relances' | 'taches' | 'habitudes' | 'finances' | 'mail' | 'plus';

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
        {name === 'mail' && <Path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM4.5 6.5 12 13l7.5-6.5" {...p} />}
        {name === 'finances' && <Path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v3M4 7.5V17a2 2 0 0 0 2 2h13V8H6.5A2.5 2.5 0 0 1 4 7.5zM15.5 13.5h.01" {...p} />}
        {name === 'plus' && <Path d="M4 7h16M4 12h16M4 17h16" {...p} />}
      </Svg>
    </View>
  );
}

/**
 * Bouton du milieu de la barre : noter une dépense en un geste, d'où que l'on soit. Il ouvre Finances avec la
 * fenêtre de saisie déjà ouverte (une valeur nouvelle à chaque appui, pour la rouvrir même si l'on y est déjà).
 */
// La clé du thème fait recalculer les couleurs de la barre d'onglets.
// La barre d'onglets a peu de place : ses libellés grandissent moins que le reste.
const MAX_BARRE = 1.15;

const optionsTabs = (_cle: string, bureau: boolean, decalage: number, e: number, cachee: boolean) => ({
  headerShown: false,
  tabBarActiveTintColor: C.accent,
  tabBarInactiveTintColor: C.muted,
  ...(bureau
    ? {}
    : {
        // Barre flottante arrondie, détachée du bas de l'écran.
        tabBarStyle: {
          // Dans le navigateur, le clavier ne la masque pas tout seul : elle cacherait le champ.
          display: cachee ? ('none' as const) : ('flex' as const),
          position: 'absolute' as const,
          left: 12,
          right: 12,
          bottom: decalage,
          height: HAUTEUR_BARRE,
          // La barre flotte au-dessus de la zone sûre : pas de rembourrage pour le geste d'accueil à l'intérieur.
          paddingTop: 0,
          paddingBottom: 0,
          paddingHorizontal: 4,
          borderRadius: 26,
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: ligneHaute(),
          borderTopColor: ligneHaute(),
          backgroundColor: surfaceHaute(),
          // Au-dessus du contenu qui défile (les cartes animées créent leur propre couche).
          zIndex: 10,
          shadowColor: '#000',
          shadowOpacity: C.sombre ? 0.55 : 0.16,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: 14 },
          elevation: 12,
        },
        tabBarItemStyle: { paddingHorizontal: 0, paddingVertical: 8 },
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 11 * e, fontFamily: F.texteF, letterSpacing: -0.1 },
      }),
  tabBarBadgeStyle: { backgroundColor: C.agressif, color: '#FFFFFF', fontSize: 11 },
  sceneStyle: { backgroundColor: C.bg },
});

type Raccourci = { cle: ClePage; couleur: string; compte?: number };
const TAILLE_RAIL = 54;
const ombreRail = () => ({ shadowColor: '#000', shadowOpacity: C.sombre ? 0.5 : 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 });

/** Le bouton + : il ajoute ce que montre l'écran actif (voir `ajoutDeVue`). */
function BoutonAjout({ label, couleur, mail, onPress }: { label: string; couleur: string; mail?: boolean; onPress: () => void }) {
  const c = teinteDe(couleur);
  const signe = teinte(c).encre;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ width: TAILLE_RAIL, height: TAILLE_RAIL, borderRadius: TAILLE_RAIL / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: c, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }], shadowColor: C.sombre ? c : '#000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 })}>
      {mail ? (
        <Icone nom="crayon" color={signe} size={23} />
      ) : (
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Path d="M12 5v14M5 12h14" stroke={signe} strokeWidth={2.4} strokeLinecap="round" />
        </Svg>
      )}
    </Pressable>
  );
}

/** La capsule d'accès directs : Calendrier, Projets, Bilan, Comptes rendus et Habitudes, sans passer par le Menu. */
function Raccourcis({ liste }: { liste: Raccourci[] }) {
  return (
    <View style={[{ height: TAILLE_RAIL, borderRadius: TAILLE_RAIL / 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5, borderWidth: 1, borderColor: ligneHaute(), backgroundColor: surfaceHaute() }, ombreRail()]}>
      {liste.map((x) => {
        const p = page(x.cle);
        return (
          <Pressable
            key={x.cle}
            accessibilityRole="link"
            accessibilityLabel={x.compte ? `${p.titre}, ${x.compte}` : p.titre}
            onPress={() => {
              tap();
              router.push(p.href);
            }}
            style={({ pressed }) => ({ flex: 1, maxWidth: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? alpha(C.ink, 0.08) : 'transparent' })}>
            <Icone nom={p.icone} color={x.couleur} size={21} />
            {x.compte ? (
              <View style={{ position: 'absolute', top: 2, right: 0, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.agressif }}>
                <Text fixe style={{ color: '#FFFFFF', fontFamily: F.texteF, fontSize: 10 }}>
                  {x.compte}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Déclenche la voix d'un geste. Quand l'app parle, la couronne s'y anime et un appui la coupe. */
function BoutonVoix() {
  const parle = useSyncExternalStore(surParole, enParole, () => false);
  const t = teinteCopilote();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={parle ? 'Arrêter la voix' : 'Parler à l’app'}
      onPress={() => {
        tap();
        if (parle) taire();
        else ouvrirVoix();
      }}
      style={({ pressed }) => [{ width: TAILLE_RAIL, height: TAILLE_RAIL, borderRadius: TAILLE_RAIL / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: parle ? t.c : ligneHaute(), backgroundColor: surfaceHaute(), opacity: pressed ? 0.85 : 1 }, ombreRail()]}>
      {parle ? (
        <Ondes mode="parle" couleur={t.c} couleur2={C.accent} taille={52}>
          <Icone nom="onde" color={t.c} size={14} />
        </Ondes>
      ) : (
        <Icone nom="micro" color={t.c} size={24} />
      )}
    </Pressable>
  );
}

export default function TabsLayout() {
  const echelleBarre = Math.min(useEchelleTexte(), MAX_BARRE);
  const { espace, mails } = useStore();
  const cle = useThemeCle();
  const clavier = useClavier();
  const { bureau, decalage, haut } = useBarreOnglets();
  const chemin = usePathname();
  const { vue } = useGlobalSearchParams<{ vue?: string }>();
  const { relances: rel, taches: tac, habitudes: hab } = compteursDuJour(espace, today());
  const badge = (n: number) => (n ? n : undefined);
  // Pages masquées depuis Mon compte > Préférences : Finances emporte le bouton Dépense, « À faire » part quand
  // les tâches et les relances sont masquées toutes les deux. Les écrans restent ouvrables (recherche, liens).
  const masquees = pagesMasquees(espace);
  const cache = { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } };
  const sansFinances = masquees.has('finances');
  const sansAFaire = masquees.has('taches') && masquees.has('relances');
  const tac2 = masquees.has('taches') ? 0 : tac;
  const rel2 = masquees.has('relances') ? 0 : rel;
  const hab2 = masquees.has('habitudes') ? 0 : hab;
  // Sur téléphone : Accueil, À faire, Mails, Finances, Menu, et au-dessus le rail : micro, accès directs, bouton + qui suit l'écran actif.
  const ajout = !bureau && !clavier ? ajoutDeVue(chemin, vue) : null;
  const raccourcis = (
    [
      { cle: 'calendrier', couleur: C.accent },
      { cle: 'projets', couleur: C.normal },
      { cle: 'bilan', couleur: C.hebdo },
      { cle: 'comptes-rendus', couleur: C.normal },
      { cle: 'habitudes', couleur: teinteDe('/habitudes'), compte: hab2 },
    ] as Raccourci[]
  ).filter((x) => !masquees.has(x.cle));
  // « À faire » réunit les tâches et les relances (avec leurs deux nombres).
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={optionsTabs(cle, bureau, decalage, echelleBarre, Platform.OS === 'web' && clavier > 0)}
        // Sur ordinateur, la barre latérale de l'app (dans le layout racine) remplace la barre d'onglets.
        tabBar={bureau ? () => null : undefined}>
        <Tabs.Screen name="index" options={{ tabBarActiveTintColor: teinteDe('/'), title: "Aujourd'hui", tabBarLabel: bureau ? "Aujourd'hui" : 'Accueil', tabBarIcon: ({ color, focused }) => <Icon name="jour" color={color} actif={focused && !bureau} /> }} />
        <Tabs.Screen name="taches" options={{ tabBarActiveTintColor: teinteDe('/taches'), title: bureau ? 'Tâches' : 'À faire', tabBarBadge: badge(bureau ? tac2 : tac2 + rel2), tabBarIcon: ({ color, focused }) => <Icon name="taches" color={color} actif={focused && !bureau} />, ...(sansAFaire ? cache : {}) }} />
        <Tabs.Screen name="messages" options={masquees.has('messages') ? { title: 'Mails', ...cache } : { tabBarActiveTintColor: teinteDe('/messages'), title: 'Mails', tabBarBadge: badge(mails.filter((m) => m.nonLu).length), tabBarIcon: ({ color, focused }) => <Icon name="mail" color={color} actif={focused && !bureau} /> }} />
        <Tabs.Screen name="ajouter" options={{ title: 'Ajouter une dépense', ...cache }} />
        <Tabs.Screen name="finances" options={{ tabBarActiveTintColor: teinteDe('/finances'), title: 'Finances', tabBarIcon: ({ color, focused }) => <Icon name="finances" color={color} actif={focused && !bureau} />, ...(sansFinances ? cache : {}) }} />
        <Tabs.Screen name="plus" options={{ tabBarActiveTintColor: teinteDe('/plus'), title: 'Menu', tabBarIcon: ({ color, focused }) => <Icon name="plus" color={color} actif={focused && !bureau} /> }} />
        {/* Sans bouton dans la barre, mais toujours ouvrables (`href: null` les rendrait inaccessibles et redirigerait). */}
        <Tabs.Screen name="relances" options={{ title: 'Relances', tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
        <Tabs.Screen name="habitudes" options={{ title: 'Habitudes', tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      </Tabs>
      {ajout ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom: haut + 10, zIndex: 15, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BoutonVoix />
          <View style={{ flex: 1, minWidth: 0 }}>{raccourcis.length ? <Raccourcis liste={raccourcis} /> : null}</View>
          {ajout.depense && sansFinances ? null : <BoutonAjout label={ajout.label} couleur={ajout.couleur} mail={ajout.mail} onPress={() => router.navigate(ajoutDeVue(chemin, vue).href as never)} />}
        </View>
      ) : null}
    </View>
  );
}
