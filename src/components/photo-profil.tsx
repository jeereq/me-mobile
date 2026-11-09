import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Platform, View } from 'react-native';

import { Erreur } from '@/components/cotisations-ui';
import { Avatar } from '@/components/mail-ui';
import { useEchelleTexte } from '@/components/texte';
import { Btn } from '@/components/ui';
import { apiFormulaire, tokenStore } from '@/lib/api';
import { versJpegWeb } from '@/lib/image-web';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

/** La photo d'un membre, ou ses initiales. */
export function AvatarMembre({ nom, photo, taille = 36 }: { nom: string; photo?: string | null; taille?: number }) {
  const e = useEchelleTexte();
  // La photo grandit avec la taille de l'affichage, comme les initiales.
  if (photo) return <Image source={{ uri: photo }} accessibilityLabel={nom} style={{ width: Math.round(taille * e), height: Math.round(taille * e), borderRadius: Math.round(taille * e) / 2, backgroundColor: C.sunk }} />;
  return <Avatar nom={nom || '?'} taille={taille} />;
}

/** Plusieurs membres, serrés : le visage du groupe. */
export function VisagesGroupe({ membres, max = 6 }: { membres: { id: string; nom: string; photo?: string | null }[]; max?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {membres.slice(0, max).map((m, i) => (
        <View key={m.id} style={{ marginLeft: i ? -10 : 0, borderRadius: 20, borderWidth: 2, borderColor: C.surface }}>
          <AvatarMembre nom={m.nom} photo={m.photo} taille={34} />
        </View>
      ))}
    </View>
  );
}

/** Choisir ou changer sa photo de profil. Obligatoire pour les options de Finances. */
export function PhotoProfil() {
  const { profil, session, rafraichirCompte } = useStore();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const photo = session?.user.photo;
  const choisir = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    const a = !r.canceled ? r.assets[0] : null;
    if (!a) return;
    setEnvoi(true);
    setErreur('');
    try {
      const form = new FormData();
      if (Platform.OS === 'web') form.append('fichier', await versJpegWeb(a.file ?? a.uri, 1024), 'profil.jpg');
      else form.append('fichier', { uri: a.uri, name: 'profil.jpg', type: 'image/jpeg' } as unknown as Blob);
      await apiFormulaire('/auth/me/photo', form, await tokenStore.get());
      await rafraichirCompte();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AvatarMembre nom={profil?.nom ?? ''} photo={photo} taille={64} />
        <Btn kind={photo ? 'sec' : 'primary'} label={envoi ? 'Envoi…' : photo ? 'Changer ma photo' : 'Ajouter ma photo'} disabled={envoi} onPress={choisir} />
      </View>
      {erreur ? <Erreur texte={erreur} /> : null}
    </View>
  );
}
