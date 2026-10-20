import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { useStore } from '@/lib/store';
import { C, MONO } from '@/lib/theme';

import { Btn, Input, Panel, Screen, Seg, T } from './ui';

export function Login() {
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [nom, setNom] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn, signUp } = useStore();

  const go = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (mode === 'connexion') await signIn(email.trim(), mdp);
      else await signUp(email.trim(), mdp, nom.trim());
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: 24, paddingTop: 48 }}>
        <View>
          <Text style={{ color: C.ink, fontSize: 64, fontWeight: '800', letterSpacing: -2, textShadowColor: C.glow, textShadowRadius: 18 }}>
            me<Text style={{ color: C.accent }}>.</Text>
          </Text>
          <Text style={{ color: C.accent, fontFamily: MONO, fontSize: 12, letterSpacing: 2 }}>TON ASSISTANT PERSONNEL</Text>
        </View>
        <Panel accent>
          <Seg
            options={[
              { key: 'connexion', label: 'Se connecter' },
              { key: 'inscription', label: 'Créer un compte' },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === 'inscription' ? <Input label="Prénom" value={nom} onChangeText={setNom} autoComplete="given-name" /> : null}
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Input label="Mot de passe" value={mdp} onChangeText={setMdp} secureTextEntry autoComplete="password" />
          {msg ? <T small muted>{msg}</T> : null}
          <Btn label={mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'} onPress={go} disabled={busy || !email || mdp.length < (mode === 'inscription' ? 8 : 1)} />
        </Panel>
      </KeyboardAvoidingView>
    </Screen>
  );
}
