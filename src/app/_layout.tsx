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
import { Platform, View, useWindowDimensions } from 'react-native';

import { Bandeau } from '@/components/bandeau';
import { BarreLecture } from '@/components/barre-lecture';
import { BarriereErreur } from '@/components/barriere-erreur';
import { useChampVisible } from '@/components/clavier';
import { BarreChargement } from '@/components/barre-chargement';
import { SqueletteVue } from '@/components/squelettes';
import { ChoixPremiereConnexion } from '@/components/choix-barre';
import { BarreLaterale } from '@/components/barre-laterale';
import { Celebrations } from '@/components/celebrations';
import { AlerteLectureSeule, BandeauEspace } from '@/components/espace-actif';
import { HorsLigne } from '@/components/hors-ligne';
import { Invitation } from '@/components/invitation';
import { AccueilPublic } from '@/components/accueil-public';
import type { Section } from '@/components/entete-public';
import { PageAnnuairePublic } from '@/components/page-annuaire';
import { PageContact } from '@/components/page-contact';
import { PageCotisation } from '@/components/page-cotisation';
import { PageInvitation } from '@/components/page-invitation';
import { Login } from '@/components/login';
import { Recherche } from '@/components/recherche';
import { useTailleLue } from '@/components/texte';
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
  const [visite, setVisite] = useState<'accueil' | 'connexion' | 'inscription' | 'contact' | 'annuaire'>(lienInitial ? 'connexion' : chemin === '/contact' ? 'contact' : chemin === '/annuaire' ? 'annuaire' : 'accueil');
  const [avantContact, setAvantContact] = useState<'accueil' | 'connexion' | 'inscription'>('accueil');
  // Le visiteur n'a pas encore de navigation : l'adresse suit à la main, pour qu'on puisse partager /contact et revenir en arrière.
  const adresse = (a: string) => {
    if (Platform.OS === 'web') window.history.pushState(null, '', a);
  };
  const ouvrirContact = () => {
    setSectionVisee(undefined);
    if (visite !== 'contact') setAvantContact(visite);
    setVisite('contact');
    adresse('/contact');
  };
  const fermerContact = () => {
    setVisite(avantContact);
    adresse('/');
  };
  // Depuis le menu de la page Contact : l'accueil, à la section choisie.
  const [sectionVisee, setSectionVisee] = useState<Section | undefined>();
  const allerAccueil = (section?: Section) => {
    setSectionVisee(section);
    setVisite('accueil');
    adresse('/');
  };
  const visiteur = !session;
  useEffect(() => {
    if (Platform.OS !== 'web' || !visiteur) return;
    const surRetour = () => setVisite(window.location.pathname === '/contact' ? 'contact' : window.location.pathname === '/annuaire' ? 'annuaire' : 'accueil');
    window.addEventListener('popstate', surRetour);
    return () => window.removeEventListener('popstate', surRetour);
  }, [visiteur]);
  // Sur ordinateur, la barre latérale reste à gauche de tous les écrans, pas seulement des onglets.
  const bureau = useWindowDimensions().width >= LARGEUR_BUREAU;
  // Après connexion, une déconnexion ramène à la page d'accueil (ajusté pendant le rendu, sans effet).
  const [sessionVue, setSessionVue] = useState(session);
  if (session !== sessionVue) {
    setSessionVue(session);
    if (session) setVisite('accueil');
  }
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
  const tailleLue = useTailleLue();
  useChampVisible();
  const ready = donnees && tailleLue && (polices || !!erreurPolices);
  // Thème de l'utilisateur, sinon celui de l'admin.
  const nom = espace.apparence?.theme && THEMES[espace.apparence.theme] ? espace.apparence.theme : THEMES[config.theme.nom] ? config.theme.nom : 'jarvis';
  const accent = espace.apparence?.theme ? espace.apparence.accent : config.theme.accent;
  const cle = appliquerTheme(nom, accent || undefined);
  activerSons(espace.sons !== false);
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
    // Dans le navigateur, l'écran de démarrage vient de public/index.html.
    (globalThis as { __fermerSplash?: () => void }).__fermerSplash?.();
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

  // Un ancien lien de collecte : une page à part, avec ou sans compte.
  const ancienLien = /^\/c\/[A-Za-z0-9_-]{16}\/?$/.test(chemin);
  // L'invitation à un groupe privé : lisible sans compte, puis on se connecte pour rejoindre.
  const codeInvitation = /^\/g\/([A-Za-z0-9_-]{12})\/?$/.exec(chemin)?.[1];

  let contenu;
  if (ancienLien && (polices || erreurPolices)) contenu = <PageCotisation />;
  else if (mode === 'cloud' && ready && (!session || lien))
    contenu =
      visite === 'contact' && !lien ? (
        <PageContact
          retour={fermerContact}
          visiteur={{
            onAccueil: () => allerAccueil(),
            onSection: allerAccueil,
            onConnexion: () => setVisite('connexion'),
            onInscription: () => setVisite('inscription'),
          }}
        />
      ) : visite === 'annuaire' && !lien ? (
        <PageAnnuairePublic onAccueil={() => allerAccueil()} onConnexion={() => setVisite('connexion')} onInscription={() => setVisite('inscription')} />
      ) : visite === 'accueil' && !lien && codeInvitation ? (
        <PageInvitation code={codeInvitation} onConnexion={() => setVisite('connexion')} onInscription={() => setVisite('inscription')} />
      ) : visite === 'accueil' && !lien ? (
        <AccueilPublic section={sectionVisee} onAnnuaire={() => { setVisite('annuaire'); adresse('/annuaire'); }} onContact={ouvrirContact} onConnexion={() => setVisite('connexion')} onInscription={() => setVisite('inscription')} />
      ) : (
        <Login lien={lien} finLien={() => setLien(null)} modeInitial={visite === 'inscription' ? 'inscription' : 'connexion'} retour={lien ? undefined : () => setVisite(typeof window !== 'undefined' && window.location?.pathname === '/annuaire' ? 'annuaire' : 'accueil')} contact={lien ? undefined : ouvrirContact} />
      );
  else if (!ready)
    contenu = <SqueletteVue chemin={chemin} />;
  else
    contenu = (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
        {bureau ? <BarreLaterale /> : null}
        <ChoixPremiereConnexion />
        <View style={{ flex: 1 }}>
          <Stack screenOptions={optionsStack(cle)}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="journal" options={{ headerShown: false }} />
            <Stack.Screen name="sources" options={{ headerShown: false }} />
            <Stack.Screen name="regles" options={{ headerShown: false }} />
            <Stack.Screen name="assistant" options={{ headerShown: false }} />
            <Stack.Screen name="copilote" options={{ headerShown: false }} />
            <Stack.Screen name="config" options={{ headerShown: false }} />
            <Stack.Screen name="utilisateurs" options={{ headerShown: false }} />
            <Stack.Screen name="compte" options={{ headerShown: false }} />
            <Stack.Screen name="contact" options={{ headerShown: false }} />
            <Stack.Screen name="annuaire" options={{ headerShown: false }} />
            <Stack.Screen name="g/[code]" options={{ headerShown: false }} />
            <Stack.Screen name="abonnement" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
            <Stack.Screen name="recompenses" options={{ headerShown: false }} />
            <Stack.Screen name="projets" options={{ headerShown: false }} />
            <Stack.Screen name="comptes-rendus" options={{ headerShown: false }} />
            <Stack.Screen name="calendrier" options={{ headerShown: false }} />
            <Stack.Screen name="categories" options={{ headerShown: false }} />
            <Stack.Screen name="equipes" options={{ headerShown: false }} />
            <Stack.Screen name="equipe" options={{ headerShown: false }} />
            <Stack.Screen name="bilan" options={{ headerShown: false }} />
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
        <BarreLecture />
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
    <BarriereErreur>
      <StoreProvider>
        <Gate />
      </StoreProvider>
    </BarriereErreur>
  );
}
