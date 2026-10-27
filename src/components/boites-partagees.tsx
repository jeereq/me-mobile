import { useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import type { CompteConnecte } from '@/lib/sync';
import { C, F } from '@/lib/theme';

import { Btn, IconBtn, Input, T } from './ui';

const ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Les boîtes partagées lues avec un compte Microsoft 365 (« ventes@entreprise.fr ») : leurs mails arrivent
 * dans Mails à côté des tiens, avec leur badge, et une réponse part de la boîte partagée.
 * Il faut que l'administrateur t'ait donné accès à la boîte dans Microsoft 365.
 */
export function BoitesPartagees({ compte }: { compte: CompteConnecte }) {
  const { session, synchroniser } = useStore();
  const [adresse, setAdresse] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const boites = compte.boites ?? [];

  const enregistrer = async (liste: string[], ok: string) => {
    setBusy(true);
    setMsg('');
    try {
      await api(`/integrations/${compte.id}`, { method: 'PATCH', body: { boitesPartagees: liste }, token: session?.token });
      setMsg(ok);
      await synchroniser(true);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const ajouter = () => {
    const a = adresse.trim().toLowerCase();
    if (!ADRESSE.test(a)) return setMsg('Écris l’adresse complète de la boîte, par exemple ventes@entreprise.fr.');
    if (boites.some((b) => b.adresse === a)) return setMsg('Cette boîte est déjà lue.');
    setAdresse('');
    enregistrer([...boites.map((b) => b.adresse), a], `${a} ajoutée : ses mails arrivent dans Mails.`);
  };

  return (
    <View style={{ gap: 10 }}>
      <T small muted>
        Une boîte partagée de Microsoft 365 (ventes@, contact@, support@…) se lit avec ton compte, si ton administrateur t'y a donné accès. Ses mails arrivent dans Mails avec leur badge, et y répondre part de la boîte partagée.
      </T>
      {boites.map((b) => (
        <View key={b.adresse} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>
              {b.adresse}
            </Text>
            {b.erreur ? <T small style={{ color: C.agressif }}>{b.erreur}</T> : <T small muted>Lue à chaque synchronisation</T>}
          </View>
          <IconBtn label={`Ne plus lire ${b.adresse}`} glyph="×" danger onPress={() => enregistrer(boites.filter((x) => x.adresse !== b.adresse).map((x) => x.adresse), `${b.adresse} n'est plus lue.`)} />
        </View>
      ))}
      <Input value={adresse} onChangeText={setAdresse} placeholder="ventes@entreprise.fr" accessibilityLabel="Adresse de la boîte partagée" autoCapitalize="none" keyboardType="email-address" onSubmitEditing={ajouter} />
      <Btn small label={busy ? 'Enregistrement…' : 'Ajouter la boîte'} disabled={busy || !adresse.trim() || boites.length >= 10} onPress={ajouter} />
      {msg ? <T small muted>{msg}</T> : null}
    </View>
  );
}
