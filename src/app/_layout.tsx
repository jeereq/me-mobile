import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Login } from '@/components/login';
import { StoreProvider, useStore } from '@/lib/store';
import { C } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

function Gate() {
  const { ready, mode, session } = useStore();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (mode === 'cloud' && ready && !session) return <Login />;
  if (!ready)
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.accent,
        headerTitleStyle: { color: C.ink },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: C.bg },
        headerBackTitle: 'Retour',
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="journal" options={{ title: 'Journal & contacts' }} />
      <Stack.Screen name="sources" options={{ title: 'Agendas & outils' }} />
      <Stack.Screen name="assistant" options={{ title: 'Assistant audio' }} />
      <Stack.Screen name="config" options={{ title: 'Configuration' }} />
      <Stack.Screen name="compte" options={{ title: 'Mon compte' }} />
      <Stack.Screen name="brouillon" options={{ title: 'Brouillon de relance', presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Gate />
    </StoreProvider>
  );
}
