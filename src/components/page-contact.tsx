import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';

import { api } from '@/lib/api';
import { CONTACT, lienTel, TELEPHONE } from '@/lib/contact';
import { emailDouteux } from '@/lib/identifiant';
import { LARGEUR_PAGE } from '@/lib/mise-en-page';
import { useStore } from '@/lib/store';
import { C, F, ligneHaute, ombreAvant, surfaceHaute } from '@/lib/theme';

import { ChampTelephone, useTelephone } from './telephone';
import { Text } from './texte';
import { Btn, Input, Screen } from './ui';

function Lien({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={accessibilityLabel} onPress={onPress} hitSlop={8} style={({ pressed }) => ({ alignSelf: 'flex-start', paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

/** La page Contact (/contact) : le formulaire, le numéro et l'adresse. */
export function PageContact({ retour }: { retour: () => void }) {
  const large = useWindowDimensions().width >= 860;
  const { session } = useStore();
  const [nom, setNom] = useState(session?.user.nom ?? '');
  const [email, setEmail] = useState(session?.user.email ?? '');
  const tel = useTelephone();
  const [message, setMessage] = useState('');
  // Invisible : seul un robot le remplit.
  const [site, setSite] = useState('');
  const [etat, setEtat] = useState<'saisie' | 'envoi' | 'envoye'>('saisie');
  const [erreur, setErreur] = useState('');
  const complet = !!nom.trim() && !!email.trim() && !emailDouteux(email) && message.trim().length >= 10 && !tel.ferme;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const avant = document.title;
    document.title = 'Contact · Me';
    return () => {
      document.title = avant;
    };
  }, []);

  const envoyer = async () => {
    setEtat('envoi');
    setErreur('');
    try {
      await api('/contact', { method: 'POST', body: { nom: nom.trim(), email: email.trim(), ...(tel.complet ? { telephone: tel.complet } : {}), message: message.trim(), ...(site ? { site } : {}) } });
      setEtat('envoye');
    } catch (e) {
      setErreur((e as Error).message);
      setEtat('saisie');
    }
  };

  return (
    <Screen>
      <View style={{ width: '100%', maxWidth: LARGEUR_PAGE, alignSelf: 'center', gap: large ? 40 : 20, paddingTop: large ? 24 : 4 }}>
        <Lien label="‹ Retour" accessibilityLabel="Revenir à la page précédente" onPress={retour} />
        <View style={{ flexDirection: large ? 'row' : 'column', gap: large ? 64 : 24 }}>
          <View style={{ flex: large ? 1 : undefined, gap: 10 }}>
            <Text accessibilityRole="header" style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 40 : 28, lineHeight: large ? 46 : 33, letterSpacing: -0.8 }}>Une question ?</Text>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 15, lineHeight: 21, marginBottom: 6 }}>Écris-nous, ou appelle-nous.</Text>
            <Lien label={TELEPHONE} onPress={() => Linking.openURL(lienTel)} />
            <Lien label={CONTACT} onPress={() => Linking.openURL(`mailto:${CONTACT}`)} />
          </View>
          <View style={{ flex: large ? 1.3 : undefined, gap: 14, padding: 20, borderRadius: 24, backgroundColor: surfaceHaute(), borderWidth: 1, borderColor: ligneHaute(), ...ombreAvant() }}>
            {etat === 'envoye' ? (
              <View accessibilityLiveRegion="polite" style={{ gap: 6, paddingVertical: 32, alignItems: 'center' }}>
                <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 18 }}>Message envoyé</Text>
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14, textAlign: 'center' }}>{`Nous te répondrons à ${email.trim()}.`}</Text>
              </View>
            ) : (
              <>
                <Input label="Nom" value={nom} onChangeText={setNom} autoComplete="name" returnKeyType="next" />
                <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" returnKeyType="next" erreur={emailDouteux(email) ? 'Cette adresse n’a pas l’air complète.' : ''} />
                <ChampTelephone tel={tel} label="Téléphone (facultatif)" returnKeyType="next" />
                <Input label="Message" value={message} onChangeText={setMessage} multiline textAlignVertical="top" maxLength={3000} style={{ minHeight: 140 }} />
                <View style={{ display: 'none' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Input value={site} onChangeText={setSite} autoComplete="off" tabIndex={-1} />
                </View>
                {erreur ? <Text accessibilityLiveRegion="polite" style={{ color: C.agressif, fontFamily: F.texte, fontSize: 13.5 }}>{`${erreur} Tu peux aussi nous joindre au ${TELEPHONE}.`}</Text> : null}
                <Btn label={etat === 'envoi' ? 'Envoi…' : 'Envoyer'} onPress={envoyer} disabled={!complet || etat === 'envoi'} />
              </>
            )}
          </View>
        </View>
      </View>
    </Screen>
  );
}
