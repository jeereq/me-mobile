import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { Bandeau } from '@/components/bandeau';
import { BarreChargement } from '@/components/barre-chargement';
import { SqueletteVue } from '@/components/squelettes';
import { BarreLaterale } from '@/components/barre-laterale';
import { Celebrations } from '@/components/celebrations';
import { AlerteLectureSeule, BandeauEspace } from '@/components/espace-actif';
import { HorsLigne } from '@/components/hors-ligne';
import { Invitation } from '@/components/invitation';
import { AccueilPublic } from '@/components/accueil-public';
import { Login } from '@/components/login';
import { Recherche } from '@/components/recherche';
import { EcouteMotCle } from '@/components/mot-cle';
import { Voix } from '@/components/voix';
import { today } from '@/lib/dates';
import { genererRecurrences } from '@/lib/finances';
import { entretenir } from '@/lib/jeu';
import { lienInitial, nettoyerAdresse } from '@/lib/liens-compte';
import { LARGEUR_BUREAU } from '@/lib/mise-en-page';
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
  const { ready: donnees, mode, session, espace, config, update, chargementEspace } = useStore();
  // L'écran qui s'ouvrira : le squelette de chargement lui ressemble.
  const chemin = usePathname();
  // Lien reçu par email ou retour de Google : traité par l'écran de connexion, même si une session est ouverte.
  const [lien, setLien] = useState(lienInitial);
  // Visiteur non connecté : la page d'accueil d'abord, puis connexion ou inscription. Un lien reçu par email va directement à l'écran de connexion.
  const [visite, setVisite] = useState<'accueil' | 'connexion' | 'inscription'>(lienInitial ? 'connexion' : 'accueil');
  // Sur ordinateur, la barre latérale reste à gauche de tous les écrans, pas seulement des onglets.
  const bureau = useWindowDimensions().width >= LARGEUR_BUREAU;
  // Après connexion, une déconnexion ramène à la page d'accueil.
  useEffect(() => {
    if (session) setVisite('accueil');
  }, [session]);
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
  // À l'ouverture : un joker sauve la série si hier a été manqué, les badges en attente sont datés,
  // les paiements récurrents échus sont notés.
  useEffect(() => {
    if (!donnees) return;
    update((e) => {
      const x = entretenir(e, today());
      // Paiements récurrents (loyer, salaire…) arrivés à échéance depuis la dernière ouverture.
      const g = x.finances && genererRecurrences(x.finances, today());
      return g && g !== x.finances ? { ...x, finances: g } : x;
    });
  }, [donnees, update]);

  let contenu;
  if (mode === 'cloud' && ready && (!session || lien)) contenu = visite === 'accueil' && !lien ? <AccueilPublic onConnexion={() => setVisite('connexion')} onInscription={() => setVisite('inscription')} /> : <Login lien={lien} finLien={() => setLien(null)} modeInitial={visite === 'inscription' ? 'inscription' : 'connexion'} retour={lien ? undefined : () => setVisite('accueil')} />;
  else if (!ready)
    contenu = <SqueletteVue chemin={chemin} />;
  else
    contenu = (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
        {bureau ? <BarreLaterale /> : null}
        <View style={{ flex: 1 }}>
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
            <Stack.Screen name="projets" options={{ headerShown: false }} />
            <Stack.Screen name="calendrier" options={{ headerShown: false }} />
            <Stack.Screen name="categories" options={{ headerShown: false }} />
            <Stack.Screen name="equipes" options={{ headerShown: false }} />
            <Stack.Screen name="equipe" options={{ headerShown: false }} />
            <Stack.Screen name="statistiques" options={{ headerShown: false }} />
            <Stack.Screen name="rapport" options={{ headerShown: false }} />
            <Stack.Screen name="verifier" options={{ headerShown: false }} />
            <Stack.Screen name="reinitialiser" options={{ headerShown: false }} />
            <Stack.Screen name="voix" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="brouillon" options={{ title: 'Brouillon de relance', presentation: 'modal' }} />
          </Stack>
        </View>
        <Recherche />
        <Voix />
        <EcouteMotCle />
        {chargementEspace ? (
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.bg, zIndex: 30 }}>
            <SqueletteVue chemin={chemin} />
          </View>
        ) : null}
      </View>
    );

  return (
    <ThemeCle.Provider value={cle}>
      <StatusBar style={cle.startsWith('clair') ? 'dark' : 'light'} />
      {contenu}
      {ready && !(mode === 'cloud' && (!session || lien)) ? <Celebrations /> : null}
      {mode === 'cloud' && session && !lien && ready ? <BandeauEspace /> : null}
      {mode === 'cloud' && session && !lien && ready ? <AlerteLectureSeule /> : null}
      {mode === 'cloud' && session && !lien && ready ? <Invitation /> : null}
      {mode === 'cloud' && session && !lien && ready ? <HorsLigne /> : null}
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
