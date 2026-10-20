import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useStore } from '@/lib/store';
import { C, F, MONO } from '@/lib/theme';

import { Btn, Input, Panel, Screen, Seg, T } from './ui';

/** Emblème de me : un réacteur en anneaux, à la couleur du thème. */
function Reacteur() {
  const segments = Array.from({ length: 10 }, (_, i) => {
    const a0 = (i / 10) * 2 * Math.PI + 0.08;
    const a1 = ((i + 1) / 10) * 2 * Math.PI - 0.08;
    const p = (a: number, r: number) => `${60 + r * Math.cos(a)} ${60 + r * Math.sin(a)}`;
    return `M${p(a0, 40)} A40 40 0 0 1 ${p(a1, 40)} L${p(a1, 30)} A30 30 0 0 0 ${p(a0, 30)} Z`;
  });
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="56" stroke={C.accent} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 5" fill="none" />
      <Circle cx="60" cy="60" r="48" stroke={C.accent} strokeOpacity={0.6} strokeWidth={2} fill="none" />
      {segments.map((d, i) => (
        <Path key={i} d={d} fill={C.accent} fillOpacity={i % 2 ? 0.55 : 0.85} />
      ))}
      <Circle cx="60" cy="60" r="20" fill={C.accentSoft} stroke={C.accent} strokeWidth={2} />
      <Circle cx="60" cy="60" r="9" fill={C.accent} />
    </Svg>
  );
}

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
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Reacteur />
          <Text style={{ color: C.ink, fontSize: 60, fontFamily: F.titre, letterSpacing: -2.5, textShadowColor: C.glow, textShadowRadius: 18 }}>
            me<Text style={{ color: C.accent }}>.</Text>
          </Text>
          <Text style={{ color: C.accent, fontFamily: MONO, fontSize: 12, letterSpacing: 3 }}>TON ASSISTANT PERSONNEL</Text>
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
