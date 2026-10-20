import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Login } from '@/components/login';
import { StoreProvider, useStore } from '@/lib/store';
import { appliquerTheme, C, THEMES } from '@/lib/theme';
import { ThemeCle } from '@/lib/theme-cle';

SplashScreen.preventAutoHideAsync();

// Lit les couleurs courantes ; la clé en paramètre fait recalculer les options quand le thème change.
const optionsStack = (_cle: string) => ({
  headerStyle: { backgroundColor: C.bg },
  headerTintColor: C.accent,
  headerTitleStyle: { color: C.ink },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: C.bg },
  headerBackTitle: 'Retour',
});

function Gate() {
  const { ready, mode, session, espace, config } = useStore();
  // Thème de l'utilisateur, sinon celui de l'admin.
  const nom = espace.apparence?.theme && THEMES[espace.apparence.theme] ? espace.apparence.theme : THEMES[config.theme.nom] ? config.theme.nom : 'jarvis';
  const accent = espace.apparence?.theme ? espace.apparence.accent : config.theme.accent;
  const cle = appliquerTheme(nom, accent || undefined);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  let contenu;
  if (mode === 'cloud' && ready && !session) contenu = <Login />;
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
        <Stack.Screen name="journal" options={{ title: 'Journal & contacts' }} />
        <Stack.Screen name="sources" options={{ title: 'Agendas & outils' }} />
        <Stack.Screen name="assistant" options={{ title: 'Assistant audio' }} />
        <Stack.Screen name="config" options={{ title: 'Configuration' }} />
        <Stack.Screen name="compte" options={{ title: 'Mon compte' }} />
        <Stack.Screen name="brouillon" options={{ title: 'Brouillon de relance', presentation: 'modal' }} />
      </Stack>
    );

  return (
    <ThemeCle.Provider value={cle}>
      <StatusBar style={cle.startsWith('clair') ? 'dark' : 'light'} />
      {contenu}
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
