import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { api } from '@/lib/api';
import { CONTACT, lienTel, TELEPHONE } from '@/lib/contact';
import { emailDouteux } from '@/lib/identifiant';
import { useBarreOnglets, useZonesSures } from '@/lib/mise-en-page';
import { useStore } from '@/lib/store';
import { teinte, vive } from '@/lib/teinte';
import { C, F, ligneHaute, ombreAvant, surfaceHaute } from '@/lib/theme';
import { useThemeCle } from '@/lib/theme-cle';

import { EviteClavier } from './clavier';
import { Bloc, Bouton, EntetePublic, SEUIL_PUBLIC, type Section } from './entete-public';
import { Icone, type IconeNom } from './icones';
import { PiedPublic } from './pied-public';
import { ChampTelephone, useTelephone } from './telephone';
import { Text } from './texte';
import { Btn, Input } from './ui';

const MIN_MESSAGE = 10;

/** Le moyen le plus direct, en grand : à Kinshasa, on appelle d'abord. */
function Joindre({ icone, label, valeur, grand, onPress }: { icone: IconeNom; label: string; valeur: string; grand?: boolean; onPress: () => void }) {
  const t = teinte(vive('indigo'));
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${label} : ${valeur}`} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line, opacity: pressed ? 0.65 : 1 })}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.douce, alignItems: 'center', justifyContent: 'center' }}>
        <Icone nom={icone} color={t.c} size={20} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>{label}</Text>
        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: grand ? F.titreM : F.texteM, fontSize: grand ? 22 : 15, letterSpacing: grand ? -0.3 : 0 }}>{valeur}</Text>
      </View>
    </Pressable>
  );
}

/**
 * La page Contact (/contact) : la barre du haut, le numéro et l'adresse, et le formulaire.
 * `visiteur` : sans compte, la barre est celle de l'accueil ; connecté, elle ramène simplement à l'app.
 */
export function PageContact({ retour, visiteur }: { retour: () => void; visiteur?: { onAccueil: () => void; onSection: (s: Section) => void; onConnexion: () => void; onInscription: () => void } }) {
  const largeur = useWindowDimensions().width;
  const large = largeur >= SEUIL_PUBLIC;
  const cle = useThemeCle();
  const { haut } = useZonesSures();
  const { reserve } = useBarreOnglets();
  const t = teinte(vive('indigo'));
  const { session } = useStore();
  const [nom, setNom] = useState(session?.user.nom ?? '');
  const [email, setEmail] = useState(session?.user.email ?? '');
  const tel = useTelephone();
  const [message, setMessage] = useState('');
  // Invisible : seul un robot le remplit.
  const [site, setSite] = useState('');
  const [etat, setEtat] = useState<'saisie' | 'envoi' | 'envoye'>('saisie');
  const [erreur, setErreur] = useState('');
  const longueur = message.trim().length;
  const complet = !!nom.trim() && !!email.trim() && !emailDouteux(email) && longueur >= MIN_MESSAGE && !tel.ferme;

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

  const champNom = <Input label="Nom" value={nom} onChangeText={setNom} autoComplete="name" returnKeyType="next" />;
  const champEmail = <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" returnKeyType="next" erreur={emailDouteux(email) ? 'Cette adresse n’a pas l’air complète.' : undefined} />;

  return (
    <View key={cle} style={{ flex: 1, backgroundColor: C.bg, paddingTop: haut }}>
      <EntetePublic
        contactActif
        logoLabel={visiteur ? 'Me, page d’accueil' : 'Revenir à l’app'}
        onLogo={visiteur ? visiteur.onAccueil : retour}
        onContact={visiteur ? () => {} : undefined}
        onSection={visiteur?.onSection}
        onConnexion={visiteur?.onConnexion}
        onInscription={visiteur?.onInscription}
        droite={visiteur ? undefined : <Bouton compact kind="surface" label="Retour" accessibilityLabel="Revenir à la page précédente" onPress={retour} />}
      />
      <EviteClavier style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Bloc large={large} style={{ maxWidth: 1064, paddingTop: large ? 72 : 24, paddingBottom: large ? 72 : 40, flexDirection: large ? 'row' : 'column', alignItems: large ? 'flex-start' : 'stretch', gap: large ? 72 : 24 }}>
            <View style={{ flex: large ? 1 : undefined, gap: large ? 28 : 18 }}>
              <View style={{ gap: 10 }}>
                <Text accessibilityRole="header" style={{ color: C.ink, fontFamily: F.titre, fontSize: largeur >= 1100 ? 56 : large ? 44 : 34, lineHeight: largeur >= 1100 ? 60 : large ? 48 : 39, letterSpacing: large ? -1.4 : -0.9 }}>Une question ?</Text>
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: large ? 17 : 15, lineHeight: large ? 26 : 22 }}>Appelle-nous, ou écris-nous.</Text>
              </View>
              <View style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Joindre grand icone="telephone" label="Appeler" valeur={TELEPHONE} onPress={() => Linking.openURL(lienTel)} />
                <Joindre icone="mail" label="Écrire un mail" valeur={CONTACT} onPress={() => Linking.openURL(`mailto:${CONTACT}`)} />
              </View>
            </View>

            <View style={{ flex: large ? 1.2 : undefined, gap: 16, padding: large ? 28 : 18, borderRadius: 24, backgroundColor: surfaceHaute(), borderWidth: 1, borderColor: ligneHaute(), ...ombreAvant() }}>
              {etat === 'envoye' ? (
                <View accessibilityLiveRegion="polite" style={{ gap: 10, paddingVertical: large ? 56 : 32, alignItems: 'center' }}>
                  <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: t.douce, alignItems: 'center', justifyContent: 'center' }}>
                    <Icone nom="envoyer" color={t.c} size={24} />
                  </View>
                  <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 22 }}>Message envoyé</Text>
                  <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14.5, lineHeight: 21, textAlign: 'center' }}>{`Nous te répondrons à ${email.trim()}.`}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                    <Bouton compact kind="surface" label="Écrire un autre message" onPress={() => (setMessage(''), setEtat('saisie'))} />
                    <Bouton compact kind="texte" label="Retour" onPress={retour} />
                  </View>
                </View>
              ) : (
                <>
                  <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 19 }}>Ton message</Text>
                  {large ? (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <View style={{ flex: 1 }}>{champNom}</View>
                      <View style={{ flex: 1 }}>{champEmail}</View>
                    </View>
                  ) : (
                    <>
                      {champNom}
                      {champEmail}
                    </>
                  )}
                  <ChampTelephone tel={tel} label="Téléphone (facultatif)" returnKeyType="next" />
                  <View style={{ gap: 4 }}>
                    <Input label="Message" value={message} onChangeText={setMessage} multiline textAlignVertical="top" maxLength={3000} style={{ minHeight: 150 }} />
                    {longueur > 0 && longueur < MIN_MESSAGE ? <Text accessibilityLiveRegion="polite" style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{`${MIN_MESSAGE} caractères au moins.`}</Text> : null}
                  </View>
                  <View style={{ display: 'none' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Input value={site} onChangeText={setSite} autoComplete="off" tabIndex={-1} />
                  </View>
                  {erreur ? <Text accessibilityLiveRegion="polite" style={{ color: C.agressif, fontFamily: F.texte, fontSize: 13.5 }}>{`${erreur} Tu peux aussi nous joindre au ${TELEPHONE}.`}</Text> : null}
                  <Btn label={etat === 'envoi' ? 'Envoi…' : 'Envoyer le message'} onPress={envoyer} disabled={!complet || etat === 'envoi'} />
                </>
              )}
            </View>
          </Bloc>
          <PiedPublic large={large} aller={visiteur?.onSection} marge={reserve} />
        </ScrollView>
      </EviteClavier>
    </View>
  );
}
