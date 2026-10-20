import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Bandeau } from '@/components/bandeau';
import { BarreChargement } from '@/components/barre-chargement';
import { Celebrations } from '@/components/celebrations';
import { Login } from '@/components/login';
import { today } from '@/lib/dates';
import { entretenir } from '@/lib/jeu';
import { lienInitial, nettoyerAdresse } from '@/lib/liens-compte';
import { enregistrerServiceWorker } from '@/lib/push';
import { activerSons } from '@/lib/sons';
import { StoreProvider, useStore } from '@/lib/store';
import { appliquerTheme, C, F, THEMES } from '@/lib/theme';
import { ThemeCle } from '@/lib/theme-cle';

SplashScreen.preventAutoHideAsync();
// Sur le web, la fenêtre ouverte pour connecter un compte se referme d'elle-même et rend la main à l'app.
WebBrowser.maybeCompleteAuthSession();

// Lit les couleurs courantes ; la clé en paramètre fait recalculer les options quand le thème change.
const optionsStack = (_cle: string) => ({
  headerStyle: { backgroundColor: C.bg },
  headerTintColor: C.accent,
  headerTitleStyle: { color: C.ink, fontFamily: F.titreM },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: C.bg },
  headerBackTitle: 'Retour',
});

function Gate() {
  const { ready: donnees, mode, session, espace, config, update } = useStore();
  // Lien reçu par email ou retour de Google : traité par l'écran de connexion, même si une session est ouverte.
  const [lien, setLien] = useState(lienInitial);
  // Le routeur garde l'adresse de départ (?google=…) : une fois l'app affichée, on repart de l'accueil sans le code.
  useEffect(() => {
    if (!lienInitial || lien) return;
    const t = setTimeout(() => {
      try {
        router.replace('/');
      } catch {
        nettoyerAdresse();
      }
    }, 0);
    return () => clearTimeout(t);
  }, [lien]);
  // Une police qui ne charge pas ne bloque pas l'app : elle retombe sur celle du système.
  const [polices, erreurPolices] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold });
  const ready = donnees && (polices || !!erreurPolices);
  // Thème de l'utilisateur, sinon celui de l'admin.
  const nom = espace.apparence?.theme && THEMES[espace.apparence.theme] ? espace.apparence.theme : THEMES[config.theme.nom] ? config.theme.nom : 'jarvis';
  const accent = espace.apparence?.theme ? espace.apparence.accent : config.theme.accent;
  const cle = appliquerTheme(nom, accent || undefined);
  activerSons(espace.sons !== false);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  useEffect(enregistrerServiceWorker, []);
  // À l'ouverture : un joker sauve la série si hier a été manqué, les badges en attente sont datés.
  useEffect(() => {
    if (donnees) update((e) => entretenir(e, today()));
  }, [donnees, update]);

  let contenu;
  if (mode === 'cloud' && ready && (!session || lien)) contenu = <Login lien={lien} finLien={() => setLien(null)} />;
  else if (!ready)
    contenu = (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  else
    contenu = (
      <Stack screenOptions={optionsStack(cle)}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="journal" options={{ headerShown: false }} />
        <Stack.Screen name="sources" options={{ headerShown: false }} />
        <Stack.Screen name="assistant" options={{ headerShown: false }} />
        <Stack.Screen name="config" options={{ headerShown: false }} />
        <Stack.Screen name="compte" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="recompenses" options={{ headerShown: false }} />
        <Stack.Screen name="finances" options={{ headerShown: false }} />
        <Stack.Screen name="statistiques" options={{ headerShown: false }} />
        <Stack.Screen name="verifier" options={{ headerShown: false }} />
        <Stack.Screen name="reinitialiser" options={{ headerShown: false }} />
        <Stack.Screen name="brouillon" options={{ title: 'Brouillon de relance', presentation: 'modal' }} />
      </Stack>
    );

  return (
    <ThemeCle.Provider value={cle}>
      <StatusBar style={cle.startsWith('clair') ? 'dark' : 'light'} />
      {contenu}
      {ready && !(mode === 'cloud' && (!session || lien)) ? <Celebrations /> : null}
      {mode === 'cloud' && session && !lien ? <Bandeau /> : null}
      <BarreChargement />
    </ThemeCle.Provider>
  );
}

export default function RootLayout() {
  return (
    <StoreProvider>
      <Gate />
    </StoreProvider>
  );
}
